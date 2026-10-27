import { EmptyState } from "@oxy.so/bloom/empty-state";
import type { BloomIconComponent } from "@oxy.so/bloom/icons";
import { RiSearchLine } from "@oxy.so/bloom/icons/RiSearchLine";
import { TextField, TextFieldIcon, TextFieldInput } from "@oxy.so/bloom/text-field";
import { Tooltip, TooltipTextBubble, TooltipTrigger } from "@oxy.so/bloom/tooltip";
import { Text } from "@oxy.so/bloom/typography";
import { useState, type ReactNode } from "react";
import { View } from "react-native";
import { signInWithOxy } from "../../oxy/session";
import { PAGE_WIDTH } from "./PageLayout";

export const PAGE_COLUMN = { width: PAGE_WIDTH - 32, maxWidth: "100%" } as const;

export function AiPageHeader({
  title,
  query,
  onQuery,
  placeholder,
  actions,
}: {
  title: string;
  query: string;
  onQuery: (q: string) => void;
  placeholder: string;
  actions?: ReactNode;
}) {
  return (
    <View style={{ height: 64, flexDirection: "row", alignItems: "center", paddingHorizontal: 24, gap: 16 }}>
      <Text variant="title-2-semibold" numberOfLines={1} style={{ width: 200 }}>
        {title}
      </Text>
      <View style={{ flex: 1, alignItems: "center" }}>
        <TextField style={{ width: "100%", maxWidth: 480 }}>
          <TextFieldIcon icon={RiSearchLine} />
          <TextFieldInput label={placeholder} value={query} onValueChange={onQuery} />
        </TextField>
      </View>
      <View style={{ width: 200, flexDirection: "row", justifyContent: "flex-end", alignItems: "center", gap: 8 }}>{actions}</View>
    </View>
  );
}

export function SignedOutState({ icon, available, title, unavailable, description }: { icon: BloomIconComponent; available: boolean; title: string; unavailable: string; description?: string }) {
  return (
    <View style={{ flex: 1, justifyContent: "center", paddingBottom: 80 }}>
      <EmptyState
        icon={icon}
        title={available ? title : unavailable}
        {...(description ? { description } : {})}
        {...(available ? { action: { label: "Sign In with Oxy…", onPress: () => void signInWithOxy() } } : {})}
      />
    </View>
  );
}

export function Hint({ label, children }: { label: string; children: ReactNode }) {
  const [visible, setVisible] = useState(false);
  return (
    <Tooltip visible={visible} onVisibleChange={setVisible} position="top">
      <TooltipTrigger>
        <View onPointerEnter={() => setVisible(true)} onPointerLeave={() => setVisible(false)}>
          {children}
        </View>
      </TooltipTrigger>
      <TooltipTextBubble>{label}</TooltipTextBubble>
    </Tooltip>
  );
}
