import type { ActionExample } from "@elizaos/core";

export const examples = [
    {
        prompt: `Actors in the scene:
{{user1}}: Experienced DeFi degen. Constantly chasing high yield farms.
{{user2}}: New to DeFi, learning the ropes.

Recommendations about the actors:
None`,
        messages: [
            {
                user: "{{user1}}",
                content: {
                    text: "Yo, have you checked out $SOLARUG? Dope new yield aggregator on Solana.",
                },
            },
            {
                user: "{{user2}}",
                content: {
                    text: "Nah, I'm still trying to wrap my head around how yield farming even works haha. Is it risky?",
                },
            },
            {
                user: "{{user1}}",
                content: {
                    text: "I mean, there's always risk in DeFi, but the $SOLARUG devs seem legit. Threw a few sol into the FCweoTfJ128jGgNEXgdfTXdEZVk58Bz9trCemr6sXNx9 vault, farming's been smooth so far.",
                },
            },
        ] as ActionExample[],
        outcome: `\`\`\`json
[
{
"entity": "{{user1}}",
"ticker": "SOLARUG",
"tokenAddress": "FCweoTfJ128jGgNEXgdfTXdEZVk58Bz9trCemr6sXNx9",
"type": "BUY",
"conviction": "medium",
}
]
\`\`\``,
    },

    {
        prompt: `Actors in the scene:
{{user1}}: Solana maximalist. Believes Solana will flip Ethereum.
{{user2}}: Multichain proponent. Holds both SOL and ETH.

Recommendations about the actors:
{{user1}} has previously promoted $COPETOKEN and $SOYLENT.`,
        messages: [
            {
                user: "{{user1}}",
                content: {
                    text: "If you're not long $SOLVAULT at 7tRzKud6FBVFEhYqZS3CuQ2orLRM21bdisGykL5Sr4Dx, you're missing out. This will be the blackhole of Solana liquidity.",
                },
            },
            {
                user: "{{user2}}",
                content: {
                    text: "Idk man, feels like there's a new 'vault' or 'reserve' token every week on Sol. What happened to $COPETOKEN and $SOYLENT that you were shilling before?",
                },
            },
            {
                user: "{{user1}}",
                content: {
                    text: "$COPETOKEN and $SOYLENT had their time, I took profits near the top. But $SOLVAULT is different, it has actual utility. Do what you want, but don't say I didn't warn you when this 50x's and you're left holding your $ETH bags.",
                },
            },
        ] as ActionExample[],
        outcome: `\`\`\`json
[
{
"entity": "{{user1}}",
"ticker": "COPETOKEN",
"tokenAddress": null,
"type": "SELL",
"conviction": "low",
},
{
"entity": "{{user1}}",
"ticker": "SOYLENT",
"tokenAddress": null,
"type": "SELL",
"conviction": "low",
},
{
"entity": "{{user1}}",
"ticker": "SOLVAULT",
"tokenAddress": "7tRzKud6FBVFEhYqZS3CuQ2orLRM21bdisGykL5Sr4Dx",
"type": "BUY",
"conviction": "high",
}
]
\`\`\``,
    },

    {
        prompt: `Actors in the scene:
{{user1}}: Self-proclaimed Solana alpha caller. Allegedly has insider info.
{{user2}}: Degen gambler. Will ape into any hyped token.

Recommendations about the actors:
None`,
        messages: [
            {
                user: "{{user1}}",
                content: {
                    text: "I normally don't do this, but I like you anon, so I'll let you in on some alpha. $ROULETTE at 48vV5y4DRH1Adr1bpvSgFWYCjLLPtHYBqUSwNc2cmCK2 is going to absolutely send it soon. You didn't hear it from me 🤐",
                },
            },
            {
                user: "{{user2}}",
                content: {
                    text: "Oh shit, insider info from the alpha god himself? Say no more, I'm aping in hard.",
                },
            },
        ] as ActionExample[],
        outcome: `\`\`\`json
[
{
"entity": "{{user1}}",
"ticker": "ROULETTE",
"tokenAddress": "48vV5y4DRH1Adr1bpvSgFWYCjLLPtHYBqUSwNc2cmCK2",
"type": "BUY",
"conviction": "high",
}
]
\`\`\``,
    },

    {
        prompt: `Actors in the scene:
{{user1}}: NFT collector and trader. Bullish on Solana NFTs.
{{user2}}: Only invests based on fundamentals. Sees all NFTs as worthless JPEGs.

Recommendations about the actors:
None
`,
        messages: [
            {
                user: "{{user1}}",
                content: {
                    text: "GM. I'm heavily accumulating $PIXELAPE, the token for the Pixel Ape Yacht Club NFT collection. 10x is inevitable.",
                },
            },
            {
                user: "{{user2}}",
                content: {
                    text: "NFTs are a scam bro. There's no underlying value. You're essentially trading worthless JPEGs.",
                },
            },
            {
                user: "{{user1}}",
                content: {
                    text: "Fun staying poor 🤡 $PIXELAPE is about to moon and you'll be left behind.",
                },
            },
            {
                user: "{{user2}}",
                content: {
                    text: "Whatever man, I'm not touching that shit with a ten foot pole. Have fun holding your bags.",
                },
            },
            {
                user: "{{user1}}",
                content: {
                    text: "Don't need luck where I'm going 😎 Once $PIXELAPE at 3hAKKmR6XyBooQBPezCbUMhrmcyTkt38sRJm2thKytWc takes off, you'll change your tune.",
                },
            },
        ],
        outcome: `\`\`\`json
[
{
"entity": "{{user1}}",
"ticker": "PIXELAPE",
"tokenAddress": "3hAKKmR6XyBooQBPezCbUMhrmcyTkt38sRJm2thKytWc",
"type": "BUY",
"conviction": "high",
}
]
\`\`\``,
    },

    {
        prompt: `Actors in the scene:
{{user1}}: Contrarian investor. Bets against hyped projects.
{{user2}}: Trend follower. Buys tokens that are currently popular.

Recommendations about the actors:
None`,
        messages: [
            {
                user: "{{user2}}",
                content: {
                    text: "$SAMOYED is the talk of CT right now. Making serious moves. Might have to get a bag.",
                },
            },
            {
                user: "{{user1}}",
                content: {
                    text: "Whenever a token is the 'talk of CT', that's my cue to short it. $SAMOYED is going to dump hard, mark my words.",
                },
            },
            {
                user: "{{user2}}",
                content: {
                    text: "Idk man, the hype seems real this time. 5TQwHyZbedaH4Pcthj1Hxf5GqcigL6qWuB7YEsBtqvhr chart looks bullish af.",
                },
            },
            {
                user: "{{user1}}",
                content: {
                    text: "Hype is always real until it isn't. I'm taking out a fat short position here. Don't say I didn't warn you when this crashes 90% and you're left holding the flaming bags.",
                },
            },
        ],
        outcome: `\`\`\`json
[
{
"entity": "{{user2}}",
"ticker": "SAMOYED",
"tokenAddress": "5TQwHyZbedaH4Pcthj1Hxf5GqcigL6qWuB7YEsBtqvhr",
"type": "BUY",
"conviction": "medium",
},
{
"entity": "{{user1}}",
"ticker": "SAMOYED",
"tokenAddress": "5TQwHyZbedaH4Pcthj1Hxf5GqcigL6qWuB7YEsBtqvhr",
"type": "dont_buy",
"conviction": "high",
}
]
\`\`\``,
    },
];
