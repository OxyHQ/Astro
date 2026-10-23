import "./bench-offline";
import "../../index";
import { answerWithSkew, nativeApiSkew } from "../../src/nativeApi";

if (nativeApiSkew) answerWithSkew(nativeApiSkew, "bench-cmd.js", "bench-result.json");
else require("./bench-channel");
