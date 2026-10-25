import { io, type Socket } from "socket.io-client";
import { useOxySession, type NiloSocketAccess } from "../oxy/session";

export type NiloRooms = { databases: string[]; workspaces: string[] };

type Room = `database:${string}` | `workspace:${string}`;

const RETRY_MIN_MS = 5_000;
const RETRY_MAX_MS = 5 * 60_000;
const CHANGE_SETTLE_MS = 300;

let socket: Socket | null = null;
let socketKey: string | null = null;
let wanted = new Set<Room>();
let joined = new Set<Room>();
let connectedOnce = false;
let retryMs = RETRY_MIN_MS;
let retryTimer: ReturnType<typeof setTimeout> | undefined;
let changeTimer: ReturnType<typeof setTimeout> | undefined;
let onChange: () => void = () => {};

export const niloLiveState = () => ({ connected: !!socket?.connected, rooms: [...joined] });

function roomsOf(rooms: NiloRooms): Set<Room> {
  return new Set<Room>([...rooms.databases.map((id) => `database:${id}` as const), ...rooms.workspaces.map((id) => `workspace:${id}` as const)]);
}

const kindOf = (room: Room) => (room.startsWith("database:") ? "database" : "workspace");
const idOf = (room: Room) => room.slice(room.indexOf(":") + 1);

function changed() {
  clearTimeout(changeTimer);
  changeTimer = setTimeout(() => onChange(), CHANGE_SETTLE_MS);
}

function syncRooms() {
  const live = socket;
  if (!live?.connected) return;
  for (const room of joined) {
    if (wanted.has(room)) continue;
    joined.delete(room);
    live.emit(`${kindOf(room)}:leave`, idOf(room));
  }
  for (const room of wanted) {
    if (joined.has(room)) continue;
    joined.add(room);
    live.emit(`${kindOf(room)}:join`, idOf(room), (answer: { ok?: boolean } | undefined) => {
      if (!answer?.ok && live === socket) joined.delete(room);
    });
  }
}

function retryLater(live: Socket) {
  clearTimeout(retryTimer);
  retryTimer = setTimeout(() => {
    if (live === socket && !live.connected) live.connect();
  }, retryMs);
  retryMs = Math.min(retryMs * 2, RETRY_MAX_MS);
}

function open(access: NiloSocketAccess): Socket {
  const live = io(access.url, {
    auth: (send) => {
      const current = useOxySession.getState().niloSocket ?? access;
      current.token().then(
        (token) => send({ token }),
        () => send({}),
      );
    },
    transports: ["websocket"],
    reconnectionDelay: RETRY_MIN_MS,
    reconnectionDelayMax: RETRY_MAX_MS,
  });
  live.on("connect", () => {
    retryMs = RETRY_MIN_MS;
    joined = new Set();
    syncRooms();
    if (connectedOnce) changed();
    connectedOnce = true;
  });
  live.on("disconnect", () => {
    joined = new Set();
  });
  live.on("connect_error", () => {
    if (!live.active) retryLater(live);
  });
  live.on("database:changed", changed);
  live.on("workspace:changed", changed);
  live.on("workspace:reset", changed);
  return live;
}

function close() {
  clearTimeout(retryTimer);
  clearTimeout(changeTimer);
  socket?.disconnect();
  socket = null;
  socketKey = null;
  joined = new Set();
  connectedOnce = false;
  retryMs = RETRY_MIN_MS;
}

function follow() {
  const { account, niloSocket } = useOxySession.getState();
  const key = account && niloSocket && wanted.size ? `${account.id}|${niloSocket.url}` : null;
  if (key === socketKey) return syncRooms();
  close();
  if (!key || !niloSocket) return;
  socketKey = key;
  socket = open(niloSocket);
}

export function setNiloRooms(rooms: NiloRooms) {
  wanted = roomsOf(rooms);
  follow();
}

let started = false;

export function startNiloLive(refresh: () => void) {
  onChange = refresh;
  if (started) return;
  started = true;
  useOxySession.subscribe((s, prev) => {
    if (s.account?.id !== prev.account?.id || s.niloSocket !== prev.niloSocket) {
      if (s.account?.id !== prev.account?.id) wanted = new Set();
      follow();
    }
  });
}
