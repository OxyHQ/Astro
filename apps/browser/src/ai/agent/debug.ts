import { answerApproval, useApprovals } from "../chat/approvals";
import { buildTurnContext } from "../chat/clientContext";
import { astroHostTools } from "../chat/hostTools";
import { setContentPolicy, useContentPolicy } from "../safety/policy";
import { stopAgent, useAgent } from "./session";

export const agentDebug = { state: useAgent, approvals: useApprovals, answer: answerApproval, tools: astroHostTools, setPolicy: setContentPolicy, policy: useContentPolicy, stop: stopAgent, context: buildTurnContext };
