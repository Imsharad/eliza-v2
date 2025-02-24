import {
    logger,
    type IAgentRuntime,
    composeContext,
    generateText,
    ModelClass,
    type State,
} from "@elizaos/core";
import type { ClientBase } from "./base.ts";
import {
    type Scraper,
    Space,
    type SpaceConfig,
    RecordToDiskPlugin,
    IdleMonitorPlugin,
    type SpeakerRequest,
    SpaceParticipant,
} from "./client/index.ts";
import { SttTtsPlugin } from "./sttTtsSpaces.ts";

export interface TwitterSpaceDecisionOptions {
    maxSpeakers?: number;
    topics?: string[];
    typicalDurationMinutes?: number;
    idleKickTimeoutMs?: number;
    minIntervalBetweenSpacesMinutes?: number;
    businessHoursOnly?: boolean;
    randomChance?: number;
    enableIdleMonitor?: boolean;
    enableSttTts?: boolean;
    enableSpaceHosting: boolean;
    enableRecording?: boolean;
    voiceId?: string;
    sttLanguage?: string;
    speakerMaxDurationMs?: number;
}

interface CurrentSpeakerState {
    userId: string;
    sessionUUID: string;
    username: string;
    startTime: number;
}

export enum SpaceActivity {
    HOSTING = "hosting",
    JOINING = "joining",
    IDLE = "idle"
}

/**
 * Generate short filler text via GPT
 */
async function generateFiller(
    runtime: IAgentRuntime,
    fillerType: string
): Promise<string> {
    try {
        const context = composeContext({
            state: { fillerType } as any as State,
            template: `
# INSTRUCTIONS:
You are generating a short filler message for a Twitter Space. The filler type is "{{fillerType}}".
Keep it brief, friendly, and relevant. No more than two sentences.
Only return the text, no additional formatting.

---
`,
        });
        const output = await generateText({
            runtime,
            context,
            modelClass: ModelClass.TEXT_SMALL,
        });
        return output.trim();
    } catch (err) {
        logger.error("[generateFiller] Error generating filler:", err);
        return "";
    }
}

/**
 * Speak a filler message if STT/TTS plugin is available. Sleep a bit after TTS to avoid cutoff.
 */
async function speakFiller(
    runtime: IAgentRuntime,
    sttTtsPlugin: SttTtsPlugin | undefined,
    fillerType: string,
    sleepAfterMs = 3000
): Promise<void> {
    if (!sttTtsPlugin) return;
    const text = await generateFiller(runtime, fillerType);
    if (!text) return;

    logger.log(`[Space] Filler (${fillerType}) => ${text}`);
    await sttTtsPlugin.speakText(text);

    if (sleepAfterMs > 0) {
        await new Promise((res) => setTimeout(res, sleepAfterMs));
    }
}

/**
 * Generate topic suggestions via GPT if no topics are configured
 */
async function generateTopicsIfEmpty(
    runtime: IAgentRuntime
): Promise<string[]> {
    try {
        const context = composeContext({
            state: {} as any,
            template: `
# INSTRUCTIONS:
Please generate 5 short topic ideas for a Twitter Space about technology or random interesting subjects.
Return them as a comma-separated list, no additional formatting or numbering.

Example:
"AI Advances, Futuristic Gadgets, Space Exploration, Quantum Computing, Digital Ethics"
---
`,
        });
        const response = await generateText({
            runtime,
            context,
            modelClass: ModelClass.TEXT_SMALL,
        });
        const topics = response
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean);
        return topics.length ? topics : ["Random Tech Chat", "AI Thoughts"];
    } catch (err) {
        logger.error("[generateTopicsIfEmpty] GPT error =>", err);
        return ["Random Tech Chat", "AI Thoughts"];
    }
}

/**
 * Main class: manage a Twitter Space with N speakers max, speaker queue, filler messages, etc.
 */
export class TwitterSpaceClient {
    private runtime: IAgentRuntime;
    private client: ClientBase;
    private scraper: Scraper;
    private currentSpace?: Space;
    private spaceId?: string;
    private startedAt?: number;
    private checkInterval?: NodeJS.Timeout;
    private lastSpaceEndedAt?: number;
    private sttTtsPlugin?: SttTtsPlugin;
    public spaceStatus: SpaceActivity = SpaceActivity.IDLE;
    private spaceParticipant: SpaceParticipant | null = null;

    /**
     * We now store an array of active speakers, not just 1
     */
    private activeSpeakers: CurrentSpeakerState[] = [];
    private speakerQueue: SpeakerRequest[] = [];

    private decisionOptions: TwitterSpaceDecisionOptions;

    constructor(client: ClientBase, runtime: IAgentRuntime) {
        this.client = client;
        this.scraper = client.twitterClient;
        this.runtime = runtime;

        // TODO: Spaces should be added to and removed from cache probably, and it should be possible to join or leave a space from an action, etc
        const charSpaces = runtime.character.settings?.twitter?.spaces || {};
        console.log("charSpaces: ", charSpaces)
        this.decisionOptions = {
            maxSpeakers: charSpaces.maxSpeakers ?? 1,
            topics: charSpaces.topics ?? [],
            typicalDurationMinutes: charSpaces.typicalDurationMinutes ?? 30,
            idleKickTimeoutMs: charSpaces.idleKickTimeoutMs ?? 5 * 60_000,
            minIntervalBetweenSpacesMinutes:
                charSpaces.minIntervalBetweenSpacesMinutes ?? 60,
            businessHoursOnly: charSpaces.businessHoursOnly ?? false,
            randomChance: charSpaces.randomChance ?? 0.3,
            enableIdleMonitor: charSpaces.enableIdleMonitor !== false,
            enableSttTts: charSpaces.enableSttTts !== false,
            enableRecording: charSpaces.enableRecording !== false,
            enableSpaceHosting: charSpaces.enableSpaceHosting || false,
            voiceId:
                charSpaces.voiceId ||
                runtime.character.settings.voice.model ||
                "Xb7hH8MSUJpSbSDYk0k2",
            sttLanguage: charSpaces.sttLanguage || "en",
            speakerMaxDurationMs: charSpaces.speakerMaxDurationMs ?? 4 * 60_000,
        };
    }

    /**
     * Periodic check to launch or manage space
     */
    public async startPeriodicSpaceCheck() {
        logger.log("[Space] Starting periodic check routine...");

        // For instance:
        const intervalMsWhenIdle = 5 * 60_000; // 5 minutes if no Space is running
        const intervalMsWhenRunning = 5_000; // 5 seconds if a Space IS running

        const routine = async () => {
            try {
                if (this.spaceStatus === SpaceActivity.IDLE) {
                    if (this.decisionOptions.enableSpaceHosting) {
                        // Space not running => check if we should launch
                        const launch = await this.shouldLaunchSpace();
                        if (launch) {
                            const config = await this.generateSpaceConfig();
                            await this.startSpace(config);
                        }
                    }
                    // Plan next iteration with a slower pace
                    this.checkInterval = setTimeout(
                        routine,
                        this.spaceStatus !== SpaceActivity.IDLE
                            ? intervalMsWhenRunning
                            : intervalMsWhenIdle
                    ) as any;
                } else {
                    if (this.spaceStatus === SpaceActivity.HOSTING) {
                        // Space is running => manage it more frequently
                        await this.manageCurrentSpace();
                    }
                    
                    // Plan next iteration with a faster pace
                    this.checkInterval = setTimeout(
                        routine,
                        intervalMsWhenRunning
                    ) as any;
                }
            } catch (error) {
                logger.error("[Space] Error in routine =>", error);
                // In case of error, still schedule next iteration
                this.checkInterval = setTimeout(routine, intervalMsWhenIdle) as any;
            }
        };

        routine();
    }

    stopPeriodicCheck() {
        if (this.checkInterval) {
            clearTimeout(this.checkInterval);
            this.checkInterval = undefined;
        }
    }

    private async joinSpace(spaceId: string) {
        if (this.spaceStatus !== SpaceActivity.IDLE) {
            logger.warn("currently hosting/joining a space");
            return null;
        }

        if (!this.spaceParticipant) {
            this.spaceParticipant = new SpaceParticipant(this.client.twitterClient, {
                debug: false,
            });
        }
        if (this.spaceParticipant) {
            try {
                await this.spaceParticipant.joinAsListener(spaceId);
                return spaceId;
            } catch(error) {
                logger.error(`failed to join space ${error}`);
                return null;
            }
        }
    }

    private async shouldLaunchSpace(): Promise<boolean> {
        // Random chance
        const r = Math.random();
        if (r > (this.decisionOptions.randomChance ?? 0.3)) {
            logger.log("[Space] Random check => skip launching");
            return false;
        }
        // Business hours
        if (this.decisionOptions.businessHoursOnly) {
            const hour = new Date().getUTCHours();
            if (hour < 9 || hour >= 17) {
                logger.log("[Space] Out of business hours => skip");
                return false;
            }
        }
        // Interval
        const now = Date.now();
        if (this.lastSpaceEndedAt) {
            const minIntervalMs =
                (this.decisionOptions.minIntervalBetweenSpacesMinutes ?? 60) *
                60_000;
            if (now - this.lastSpaceEndedAt < minIntervalMs) {
                logger.log("[Space] Too soon since last space => skip");
                return false;
            }
        }

        logger.log("[Space] Deciding to launch a new Space...");
        return true;
    }

    private async generateSpaceConfig(): Promise<SpaceConfig> {
        if (
            !this.decisionOptions.topics ||
            this.decisionOptions.topics.length === 0
        ) {
            const newTopics = await generateTopicsIfEmpty(this.client.runtime);
            this.decisionOptions.topics = newTopics;
        }

        let chosenTopic = "Random Tech Chat";
        if (
            this.decisionOptions.topics &&
            this.decisionOptions.topics.length > 0
        ) {
            chosenTopic =
                this.decisionOptions.topics[
                    Math.floor(
                        Math.random() * this.decisionOptions.topics.length
                    )
                ];
        }

        return {
            record: this.decisionOptions.enableRecording,
            mode: "INTERACTIVE",
            title: chosenTopic,
            description: `Discussion about ${chosenTopic}`,
            languages: ["en"],
        };
    }

    public async startSpace(config: SpaceConfig) {
        logger.log("[Space] Starting a new Twitter Space...");

        try {
            this.currentSpace = new Space(this.scraper);
            this.spaceStatus = SpaceActivity.IDLE;
            this.spaceId = undefined;
            this.startedAt = Date.now();

            // Reset states
            this.activeSpeakers = [];
            this.speakerQueue = [];

            // Retrieve keys
            const elevenLabsKey =
                this.runtime.getSetting("ELEVENLABS_XI_API_KEY") || "";

            const broadcastInfo = await this.currentSpace.initialize(config);
            this.spaceId = broadcastInfo.room_id;
            // Plugins
            if (this.decisionOptions.enableRecording) {
                logger.log("[Space] Using RecordToDiskPlugin");
                this.currentSpace.use(new RecordToDiskPlugin());
            }

            if (this.decisionOptions.enableSttTts) {
                logger.log("[Space] Using SttTtsPlugin");
                const sttTts = new SttTtsPlugin();
                this.sttTtsPlugin = sttTts;
                // TODO: There is an error here, onAttach is incompatible
                this.currentSpace.use(sttTts as any, {
                    runtime: this.runtime,
                    client: this.client,
                    spaceId: this.spaceId,
                    elevenLabsApiKey: elevenLabsKey,
                    voiceId: this.decisionOptions.voiceId,
                    sttLanguage: this.decisionOptions.sttLanguage,
                });
            }

            if (this.decisionOptions.enableIdleMonitor) {
                logger.log("[Space] Using IdleMonitorPlugin");
                this.currentSpace.use(
                    new IdleMonitorPlugin(
                        this.decisionOptions.idleKickTimeoutMs ?? 60_000,
                        10_000
                    )
                );
            }
            this.spaceStatus = SpaceActivity.HOSTING;
            await this.scraper.sendTweet(
                broadcastInfo.share_url.replace("broadcasts", "spaces")
            );

            const spaceUrl = broadcastInfo.share_url.replace(
                "broadcasts",
                "spaces"
            );
            logger.log(`[Space] Space started => ${spaceUrl}`);

            // Greet
            await speakFiller(
                this.client.runtime,
                this.sttTtsPlugin,
                "WELCOME"
            );

            // Events
            this.currentSpace.on("occupancyUpdate", (update) => {
                logger.log(
                    `[Space] Occupancy => ${update.occupancy} participant(s).`
                );
            });

            this.currentSpace.on(
                "speakerRequest",
                async (req: SpeakerRequest) => {
                    logger.log(
                        `[Space] Speaker request from @${req.username} (${req.userId}).`
                    );
                    await this.handleSpeakerRequest(req);
                }
            );

            this.currentSpace.on("idleTimeout", async (info) => {
                logger.log(
                    `[Space] idleTimeout => no audio for ${info.idleMs} ms.`
                );
                await speakFiller(
                    this.client.runtime,
                    this.sttTtsPlugin,
                    "IDLE_ENDING"
                );
                await this.stopSpace();
            });

            process.on("SIGINT", async () => {
                logger.log("[Space] SIGINT => stopping space");
                await speakFiller(
                    this.client.runtime,
                    this.sttTtsPlugin,
                    "CLOSING"
                );
                await this.stopSpace();
                process.exit(0);
            });
        } catch (error) {
            logger.error("[Space] Error launching Space =>", error);
            this.spaceStatus = SpaceActivity.IDLE;
            throw error;
        }
    }

    /**
     * Periodic management: check durations, remove extras, maybe accept new from queue
     */
    private async manageCurrentSpace() {
        if (!this.spaceId || !this.currentSpace) return;
        try {
            const audioSpace = await this.scraper.getAudioSpaceById(
                this.spaceId
            );
            const { participants } = audioSpace;
            const numSpeakers = participants.speakers?.length || 0;
            const totalListeners = participants.listeners?.length || 0;

            // 1) Remove any speaker who exceeded speakerMaxDurationMs
            const maxDur = this.decisionOptions.speakerMaxDurationMs ?? 240_000;
            const now = Date.now();

            for (let i = this.activeSpeakers.length - 1; i >= 0; i--) {
                const speaker = this.activeSpeakers[i];
                const elapsed = now - speaker.startTime;
                if (elapsed > maxDur) {
                    logger.log(
                        `[Space] Speaker @${speaker.username} exceeded max duration => removing`
                    );
                    await this.removeSpeaker(speaker.userId);
                    this.activeSpeakers.splice(i, 1);

                    // Possibly speak a short "SPEAKER_LEFT" filler
                    await speakFiller(
                        this.client.runtime,
                        this.sttTtsPlugin,
                        "SPEAKER_LEFT"
                    );
                }
            }

            // 2) If we have capacity for new speakers from the queue, accept them
            await this.acceptSpeakersFromQueueIfNeeded();

            // 3) If somehow more than maxSpeakers are active, remove the extras
            if (numSpeakers > (this.decisionOptions.maxSpeakers ?? 1)) {
                logger.log(
                    "[Space] More than maxSpeakers => removing extras..."
                );
                await this.kickExtraSpeakers(participants.speakers);
            }

            // 4) Possibly stop the space if empty or time exceeded
            const elapsedMinutes = (now - (this.startedAt || 0)) / 60000;
            if (
                elapsedMinutes >
                    (this.decisionOptions.typicalDurationMinutes ?? 30) ||
                (numSpeakers === 0 &&
                    totalListeners === 0 &&
                    elapsedMinutes > 5)
            ) {
                logger.log(
                    "[Space] Condition met => stopping the Space..."
                );
                await speakFiller(
                    this.client.runtime,
                    this.sttTtsPlugin,
                    "CLOSING",
                    4000
                );
                await this.stopSpace();
            }
        } catch (error) {
            logger.error("[Space] Error in manageCurrentSpace =>", error);
        }
    }

    /**
     * If we have available slots, accept new speakers from the queue
     */
    private async acceptSpeakersFromQueueIfNeeded() {
        // while queue not empty and activeSpeakers < maxSpeakers, accept next
        const ms = this.decisionOptions.maxSpeakers ?? 1;
        while (
            this.speakerQueue.length > 0 &&
            this.activeSpeakers.length < ms
        ) {
            const nextReq = this.speakerQueue.shift();
            if (nextReq) {
                await speakFiller(
                    this.client.runtime,
                    this.sttTtsPlugin,
                    "PRE_ACCEPT"
                );
                await this.acceptSpeaker(nextReq);
            }
        }
    }

    private async handleSpeakerRequest(req: SpeakerRequest) {
        if (!this.spaceId || !this.currentSpace) return;

        const audioSpace = await this.scraper.getAudioSpaceById(this.spaceId);
        const janusSpeakers = audioSpace?.participants?.speakers || [];

        // If we haven't reached maxSpeakers, accept immediately
        if (janusSpeakers.length < (this.decisionOptions.maxSpeakers ?? 1)) {
            logger.log(`[Space] Accepting speaker @${req.username} now`);
            await speakFiller(
                this.client.runtime,
                this.sttTtsPlugin,
                "PRE_ACCEPT"
            );
            await this.acceptSpeaker(req);
        } else {
            logger.log(
                `[Space] Adding speaker @${req.username} to the queue`
            );
            this.speakerQueue.push(req);
        }
    }

    private async acceptSpeaker(req: SpeakerRequest) {
        if (!this.currentSpace) return;
        try {
            await this.currentSpace.approveSpeaker(req.userId, req.sessionUUID);
            this.activeSpeakers.push({
                userId: req.userId,
                sessionUUID: req.sessionUUID,
                username: req.username,
                startTime: Date.now(),
            });
            logger.log(`[Space] Speaker @${req.username} is now live`);
        } catch (err) {
            logger.error(
                `[Space] Error approving speaker @${req.username}:`,
                err
            );
        }
    }

    private async removeSpeaker(userId: string) {
        if (!this.currentSpace) return;
        try {
            await this.currentSpace.removeSpeaker(userId);
            logger.log(`[Space] Removed speaker userId=${userId}`);
        } catch (error) {
            logger.error(
                `[Space] Error removing speaker userId=${userId} =>`,
                error
            );
        }
    }

    /**
     * If more than maxSpeakers are found, remove extras
     * Also update activeSpeakers array
     */
    private async kickExtraSpeakers(speakers: any[]) {
        if (!this.currentSpace) return;
        const ms = this.decisionOptions.maxSpeakers ?? 1;

        // sort by who joined first if needed, or just slice
        const extras = speakers.slice(ms);
        for (const sp of extras) {
            logger.log(
                `[Space] Removing extra speaker => userId=${sp.user_id}`
            );
            await this.removeSpeaker(sp.user_id);

            // remove from activeSpeakers array
            const idx = this.activeSpeakers.findIndex(
                (s) => s.userId === sp.user_id
            );
            if (idx !== -1) {
                this.activeSpeakers.splice(idx, 1);
            }
        }
    }

    public async stopSpace() {
        if (!this.currentSpace || this.spaceStatus === SpaceActivity.IDLE) return;
        try {
            logger.log("[Space] Stopping the current Space...");
            await this.currentSpace.stop();
        } catch (err) {
            logger.error("[Space] Error stopping Space =>", err);
        } finally {
            this.spaceStatus = SpaceActivity.IDLE;
            this.spaceId = undefined;
            this.currentSpace = undefined;
            this.startedAt = undefined;
            this.lastSpaceEndedAt = Date.now();
            this.activeSpeakers = [];
            this.speakerQueue = [];
        }
    }
}
