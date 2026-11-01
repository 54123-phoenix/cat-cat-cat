"""Exercise the production HTTP parser over TCP, including buffered requests."""
import asyncio

from uvicorn import Config
from uvicorn.protocols.http.h11_impl import H11Protocol
from uvicorn.server import ServerState


def test_buffered_sse_survives_previous_response_keepalive_timer():
    async def scenario():
        async def app(scope, receive, send):
            if scope['path'] == '/first':
                # Allow both pipelined requests to reach the parser before the
                # first response arms its idle-connection timer.
                await asyncio.sleep(.02)
                await send({'type': 'http.response.start', 'status': 200,
                            'headers': [(b'content-length', b'2')]})
                await send({'type': 'http.response.body', 'body': b'ok'})
                return
            assert scope['path'] == '/events'
            await send({'type': 'http.response.start', 'status': 200,
                        'headers': [(b'content-type', b'text/event-stream')]})
            await send({'type': 'http.response.body', 'body': b'data: started\n\n',
                        'more_body': True})
            # Active streams must outlive the previous response's idle timer.
            await asyncio.sleep(.25)
            await send({'type': 'http.response.body', 'body': b'data: finished\n\n'})

        loop = asyncio.get_running_loop()
        errors = []
        previous_handler = loop.get_exception_handler()
        loop.set_exception_handler(lambda _loop, context: errors.append(context))
        state = ServerState()
        config = Config(app, http='h11', lifespan='off', timeout_keep_alive=.05,
                        log_config=None, access_log=False, ws='none')
        server = None
        writer = None
        try:
            server = await loop.create_server(
                lambda: H11Protocol(config, state, {}, _loop=loop), '127.0.0.1', 0)
            port = server.sockets[0].getsockname()[1]
            reader, writer = await asyncio.open_connection('127.0.0.1', port)
            writer.write(
                b'GET /first HTTP/1.1\r\nHost: localhost\r\n\r\n'
                b'GET /events HTTP/1.1\r\nHost: localhost\r\nConnection: close\r\n\r\n')
            await writer.drain()
            response = await asyncio.wait_for(reader.read(), timeout=5)
            assert response.count(b'HTTP/1.1 200 OK') == 2, response
            assert b'data: started\n\n' in response, response
            assert b'data: finished\n\n' in response, response
            assert response.endswith(b'0\r\n\r\n'), response
            assert not errors, errors
        finally:
            if writer is not None:
                writer.close()
                await writer.wait_closed()
            if server is not None:
                server.close()
                await server.wait_closed()
            for connection in list(state.connections):
                connection.shutdown()
            for task in list(state.tasks):
                task.cancel()
            if state.tasks:
                await asyncio.gather(*list(state.tasks), return_exceptions=True)
            loop.set_exception_handler(previous_handler)

    asyncio.run(scenario())
