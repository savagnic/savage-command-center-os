import asyncio
import websockets
import subprocess

async def execute_command(websocket):
    print("Web UI connected.")
    try:
        async for message in websocket:
            print(f"Executing: {message}")
            try:
                # Run the command and capture output
                process = subprocess.Popen(
                    message,
                    shell=True,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    text=True
                )
                stdout, stderr = process.communicate()

                if stdout:
                    await websocket.send(stdout)
                if stderr:
                    await websocket.send(f"ERROR:\n{stderr}")
                if not stdout and not stderr:
                    await websocket.send("[Command completed with no output]")

            except Exception as e:
                await websocket.send(f"Agent Execution Error: {str(e)}")
    except websockets.exceptions.ConnectionClosed:
        print("Web UI disconnected.")

async def main():
    print("SOVEREIGN TERMUX SUBSTRATE AGENT STARTED.")
    print("Listening on ws://127.0.0.1:8765...")
    async with websockets.serve(execute_command, "127.0.0.1", 8765):
        await asyncio.Future()  # run forever

if __name__ == "__main__":
    asyncio.run(main())
