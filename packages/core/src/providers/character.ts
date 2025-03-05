import { addHeader } from "../prompts";
import { IAgentRuntime, Memory, Provider } from "../types";

export const characterProvider: Provider = {
  name: "character",
  description: "Character information",
  get: async (runtime: IAgentRuntime, message: Memory) => {
    const character = runtime.character;

    // Character name
    const agentName = character.name;

    // Handle bio (string or random selection from array)
    let bio = character.bio || "";
    if (Array.isArray(bio)) {
      bio = bio
        .sort(() => 0.5 - Math.random())
        .slice(0, 3)
        .join(" ");
    }

    // System prompt
    const system = character.system ?? "";

    // Select random topic if available
    const topic =
      character.topics && character.topics.length > 0
        ? character.topics[Math.floor(Math.random() * character.topics.length)]
        : null;

    // Format topics list
    const topics =
      character.topics && character.topics.length > 0
        ? `${character.name} is interested in ${character.topics
            .sort(() => 0.5 - Math.random())
            .slice(0, 5)
            .map((topic, index, array) => {
              if (index === array.length - 2) {
                return `${topic} and `;
              }
              if (index === array.length - 1) {
                return topic;
              }
              return `${topic}, `;
            })
            .join("")}`
        : "";

    // Select random adjective if available
    const adjective =
      character.adjectives && character.adjectives.length > 0
        ? character.adjectives[
            Math.floor(Math.random() * character.adjectives.length)
          ]
        : "";

    // Format post examples
    const formattedCharacterPostExamples = !character.postExamples
      ? ""
      : character.postExamples
          .sort(() => 0.5 - Math.random())
          .map((post) => {
            const messageString = `${post}`;
            return messageString;
          })
          .slice(0, 50)
          .join("\n");

    const characterPostExamples =
      formattedCharacterPostExamples &&
      formattedCharacterPostExamples.replaceAll("\n", "").length > 0
        ? addHeader(
            `# Example Posts for ${character.name}`,
            formattedCharacterPostExamples
          )
        : "";

    // Format message examples
    const formattedCharacterMessageExamples = !character.messageExamples
      ? ""
      : character.messageExamples
          .sort(() => 0.5 - Math.random())
          .slice(0, 5)
          .map((example) => {
            const exampleNames = Array.from({ length: 5 }, () =>
              Math.random().toString(36).substring(2, 8)
            );

            return example
              .map((message) => {
                let messageString = `${message.user}: ${message.content.text}${
                  message.content.action
                    ? ` (action: ${message.content.action})`
                    : ""
                }`;
                exampleNames.forEach((name, index) => {
                  const placeholder = `{{user${index + 1}}}`;
                  messageString = messageString.replaceAll(placeholder, name);
                });
                return messageString;
              })
              .join("\n");
          })
          .join("\n\n");

    const characterMessageExamples =
      formattedCharacterMessageExamples &&
      formattedCharacterMessageExamples.replaceAll("\n", "").length > 0
        ? addHeader(
            `# Example Conversations for ${character.name}`,
            formattedCharacterMessageExamples
          )
        : "";

    // Style directions
    const postDirections =
      character?.style?.all?.length > 0 || character?.style?.post?.length > 0
        ? addHeader(
            `# Post Directions for ${character.name}`,
            (() => {
              const all = character?.style?.all || [];
              const post = character?.style?.post || [];
              return [...all, ...post].join("\n");
            })()
          )
        : "";

    const messageDirections =
      character?.style?.all?.length > 0 || character?.style?.chat?.length > 0
        ? addHeader(
            `# Message Directions for ${character.name}`,
            (() => {
              const all = character?.style?.all || [];
              const chat = character?.style?.chat || [];
              return [...all, ...chat].join("\n");
            })()
          )
        : "";

    const values = {
      bio,
      system,
      topic,
      topics,
      adjective,
      messageDirections,
      postDirections,
      characterPostExamples,
      characterMessageExamples,
    };

    // Combine all text sections
    const text = [
      messageDirections,
      postDirections,
      characterPostExamples,
      characterMessageExamples,
    ]
      .filter(Boolean)
      .join("\n\n");

    return {
      values,
      text,
    };
  },
};
