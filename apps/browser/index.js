import "./src/telemetry/jsStart";
import "./src/lib/perfProbe";
import { LogBox } from "react-native";
import { nativeApiSkew, startSkewed } from "./src/nativeApi";

LogBox.ignoreLogs(["The app is running using the Legacy Architecture"]);
LogBox.ignoreAllLogs(true);

if (nativeApiSkew) startSkewed(nativeApiSkew);
else require("./src/main");
