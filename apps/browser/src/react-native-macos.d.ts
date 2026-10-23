import "react-native";

declare module "react-native" {
  interface ViewProps {
    tooltip?: string;
  }
}
