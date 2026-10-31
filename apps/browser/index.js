import "./src/telemetry/jsStart";
import "./src/lib/perfProbe";
import { LogBox } from "react-native";
import { nativeApiSkew, startSkewed } from "./src/nativeApi";

LogBox.ignoreAllLogs(true);

if (nativeApiSkew) startSkewed(nativeApiSkew);
else require("./src/main");
