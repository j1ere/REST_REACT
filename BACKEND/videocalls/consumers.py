import json
from channels.generic.websocket import AsyncWebsocketConsumer

class SignalingConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.room_name = "video_call_room"
        self.room_group_name = f"signaling_{self.room_name}"
        print(f"Client connected to room: {self.room_name} (channel: {self.channel_name})")
        await self.channel_layer.group_add(self.room_group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        print(f"Client disconnected from room: {self.room_name} (channel: {self.channel_name})")
        await self.channel_layer.group_discard(self.room_group_name, self.channel_name)

    async def receive(self, text_data):
        data = json.loads(text_data)
        print(f"Received message in room {self.room_name}: {data}")
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                "type": "signal_message",
                "message": text_data,
                "sender": self.channel_name,
            },
        )

    async def signal_message(self, event):
        if self.channel_name != event["sender"]:
            print(f"Sending message to client in room {self.room_name}: {event['message']}")
            await self.send(text_data=event["message"])

# from channels.generic.websocket import AsyncWebsocketConsumer
# import json


# class SignalingConsumer(AsyncWebsocketConsumer):
#     async def connect(self):
#         await self.accept()
#         self.room_name = 'video_call_room' #fixed room for p2p
#         await self.channel_layer.group_add(self.room_name, self.channel_name)

    
#     async def disconnect(self, close_code):
#         await self.channel_layer.group_discard(self.room_name, self.channel_name)

#     async def receive(self, text_data):
#         await self.channel_layer.group_send(
#             self.room_name,
#             {
#                 "type": "signal.message",
#                 "message": text_data,
#                 "sender": self.channel_name,
#             },
#         )

#     async def signal_message(self, event):
#         if self.channel_name != event["sender"]:
#             await self.send(text_data=event["message"])


