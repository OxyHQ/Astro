import asyncio
import itertools
import json

from astro_cli import guard


class CdpError(Exception):
    pass


class ConnectionLost(Exception):
    pass


class Cdp:
    def __init__(self, url: str):
        self.url = url
        self.socket = None
        self.ids = itertools.count(1)
        self.waiting: dict[int, asyncio.Future] = {}
        self.listeners: list = []
        self.reader: asyncio.Task | None = None
        self.closed = asyncio.Event()

    async def open(self, timeout: float):
        self.socket = await asyncio.wait_for(guard.direct_connect(self.url, max_size=None), timeout)
        self.reader = asyncio.ensure_future(self._read())

    async def _read(self):
        try:
            async for raw in self.socket:
                try:
                    message = json.loads(raw)
                except ValueError:
                    continue
                if "id" in message:
                    future = self.waiting.pop(message["id"], None)
                    if future and not future.done():
                        future.set_result(message)
                    continue
                for listener in list(self.listeners):
                    listener(message.get("method"), message.get("params") or {}, message.get("sessionId"))
        except Exception:
            pass
        finally:
            self.closed.set()
            for future in self.waiting.values():
                if not future.done():
                    future.set_exception(ConnectionLost())
            self.waiting.clear()

    async def send(self, method: str, params: dict | None = None, session: str | None = None, timeout: float = 15):
        if self.closed.is_set():
            raise ConnectionLost()
        command_id = next(self.ids)
        message = {"id": command_id, "method": method, "params": params or {}}
        if session:
            message["sessionId"] = session
        future = asyncio.get_running_loop().create_future()
        self.waiting[command_id] = future
        try:
            await self.socket.send(json.dumps(message))
            reply = await asyncio.wait_for(future, timeout)
        except asyncio.TimeoutError:
            raise CdpError(f"{method} got no answer in {timeout:g}s") from None
        except ConnectionLost:
            raise
        except Exception as error:
            if self.closed.is_set():
                raise ConnectionLost() from None
            raise CdpError(f"{method}: {error}") from None
        finally:
            self.waiting.pop(command_id, None)
        if "error" in reply:
            raise CdpError(reply["error"].get("message") or f"{method} failed")
        return reply.get("result") or {}

    async def close(self):
        if self.socket is not None:
            try:
                await asyncio.wait_for(self.socket.close(), 3)
            except Exception:
                pass
        if self.reader is not None:
            self.reader.cancel()
            await asyncio.gather(self.reader, return_exceptions=True)
