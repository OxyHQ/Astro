import { Symbol } from "@astro-browser/shell";
import { Image, Text, View } from "react-native";
import { useTheme } from "../../lib/theme";
import { accountInitial, type OxyAccount } from "../../oxy/session";

const SIGNED_OUT_LIGHT = "#C7C7CC";
const SIGNED_OUT_DARK = "#636366";
const FALLBACK_COLOR = "#8E8E93";

export function AccountAvatar({ account, size }: { account: OxyAccount | null; size: number }) {
  const theme = useTheme();
  const round = { width: size, height: size, borderRadius: size / 2 };
  if (account?.avatar) return <Image source={{ uri: account.avatar }} style={round} />;
  if (!account) {
    return (
      <View style={[round, { alignItems: "center", justifyContent: "center", backgroundColor: theme.dark ? SIGNED_OUT_DARK : SIGNED_OUT_LIGHT }]}>
        <Symbol name="person.fill" size={size * 0.52} color="#FFFFFF" style={{ width: size * 0.6, height: size * 0.6 }} />
      </View>
    );
  }
  return (
    <View style={[round, { alignItems: "center", justifyContent: "center", backgroundColor: account.color || FALLBACK_COLOR }]}>
      <Text style={{ fontSize: size * 0.44, fontWeight: "600", color: "#FFFFFF" }}>{accountInitial(account)}</Text>
    </View>
  );
}
