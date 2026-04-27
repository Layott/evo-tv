"use client";

import { BotConfigPage } from "@/components/integrations/bot-config-page";

export default function DiscordIntegrationPage() {
  return (
    <BotConfigPage
      kind="discord"
      brand={{
        label: "Discord",
        accent: "bg-indigo-500/15 text-indigo-300 ring-indigo-500/30",
        helpToken:
          "Create a bot at discord.com/developers/applications, copy the bot token under the Bot tab.",
        helpServerLabel: "Server (Guild) ID",
        helpServerHint: "Discord server IDs are 17–20 digits. Enable Developer Mode to copy yours.",
        serverLabelTitle: "Server name",
        placeholderToken:
          "MTAwMDAwMDAwMDAwMDAwMDAw.YxYxYx.aBcDeFgHiJkLmNoPqRsTuVwXyZ123456",
        placeholderServer: "1234567890123456789",
        iconKind: "discord",
      }}
    />
  );
}
