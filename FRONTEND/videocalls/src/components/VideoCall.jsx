// // src/components/VideoCall.jsx
// import React, { useEffect, useRef, useState } from "react";

// const VideoCall = () => {
//   const localVideoRef = useRef(null);
//   const remoteVideoRef = useRef(null);
//   const peerConnectionRef = useRef(null);
//   const wsRef = useRef(null);
//   const [connected, setConnected] = useState(false);

//   useEffect(() => {
//     const startWebRTC = async () => {
//       // Get local media stream
//       const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
//       localVideoRef.current.srcObject = stream;

//       // Setup WebSocket
//       const ws = new WebSocket("ws://localhost:8000/ws/signaling/");
//       wsRef.current = ws;

//       // Setup RTCPeerConnection
//       const peerConnection = new RTCPeerConnection({
//         iceServers: [
//           { urls: "stun:stun.l.google.com:19302" },
//         ],
//       });

//       peerConnectionRef.current = peerConnection;

//       // Add local stream tracks to peer connection
//       stream.getTracks().forEach((track) => peerConnection.addTrack(track, stream));

//       // When ICE candidates are found
//       peerConnection.onicecandidate = (event) => {
//         if (event.candidate) {
//           ws.send(JSON.stringify({ type: "ice", candidate: event.candidate }));
//         }
//       };

//       // When remote stream is received
//       peerConnection.ontrack = (event) => {
//         if (remoteVideoRef.current.srcObject !== event.streams[0]) {
//           remoteVideoRef.current.srcObject = event.streams[0];
//         }
//       };

//       // Handle incoming WebSocket messages
//       ws.onmessage = async (event) => {
//         const data = JSON.parse(event.data);

//         if (data.type === "offer") {
//           await peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer));
//           const answer = await peerConnection.createAnswer();
//           await peerConnection.setLocalDescription(answer);
//           ws.send(JSON.stringify({ type: "answer", answer }));
//           setConnected(true);
//         } else if (data.type === "answer") {
//           await peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
//           setConnected(true);
//         } else if (data.type === "ice") {
//           try {
//             await peerConnection.addIceCandidate(data.candidate);
//           } catch (e) {
//             console.error("Error adding ICE candidate", e);
//           }
//         }
//       };

//       // Send offer
//       const offer = await peerConnection.createOffer();
//       await peerConnection.setLocalDescription(offer);
//       ws.send(JSON.stringify({ type: "offer", offer }));
//     };

//     startWebRTC();

//     return () => {
//       wsRef.current?.close();
//       peerConnectionRef.current?.close();
//     };
//   }, []);

//   return (
//     <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
//       <h2>Video Call</h2>
//       <div style={{ display: "flex", gap: "20px" }}>
//         <video ref={localVideoRef} autoPlay playsInline muted style={{ width: "300px", border: "2px solid green" }}></video>
//         <video ref={remoteVideoRef} autoPlay playsInline style={{ width: "300px", border: "2px solid blue" }}></video>
//       </div>
//       <p>{connected ? "Connected to peer." : "Connecting..."}</p>
//     </div>
//   );
// };

// export default VideoCall;














// src/components/VideoCall.jsx
import React, { useEffect, useRef, useState } from "react";
import VideoContainer from "./VideoContainer";
import VideoControls from "./VideoControls";

const VideoCall = () => {
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [connected, setConnected] = useState(false);

  const peerConnectionRef = useRef(null);
  const wsRef = useRef(null);

  useEffect(() => {
    const startWebRTC = async () => {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      setLocalStream(stream);

      const ws = new WebSocket("ws://localhost:8000/ws/signaling/");
      wsRef.current = ws;

      const peerConnection = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
      });
      peerConnectionRef.current = peerConnection;

      stream.getTracks().forEach((track) => peerConnection.addTrack(track, stream));

      peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          ws.send(JSON.stringify({ type: "ice", candidate: event.candidate }));
        }
      };

      peerConnection.ontrack = (event) => {
        if (!remoteStream) {
          const inboundStream = new MediaStream();
          setRemoteStream(inboundStream);
        }
        setRemoteStream((prev) => {
          if (!prev.getTracks().includes(event.track)) {
            prev.addTrack(event.track);
          }
          return prev;
        });
      };

      ws.onmessage = async (event) => {
        const data = JSON.parse(event.data);

        if (data.type === "offer") {
          await peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer));
          const answer = await peerConnection.createAnswer();
          await peerConnection.setLocalDescription(answer);
          ws.send(JSON.stringify({ type: "answer", answer }));
          setConnected(true);
        } else if (data.type === "answer") {
          await peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
          setConnected(true);
        } else if (data.type === "ice") {
          try {
            await peerConnection.addIceCandidate(data.candidate);
          } catch (e) {
            console.error("Error adding ICE candidate", e);
          }
        }
      };

      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);
      ws.send(JSON.stringify({ type: "offer", offer }));
    };

    startWebRTC();

    return () => {
      wsRef.current?.close();
      peerConnectionRef.current?.close();
    };
  }, []);

  const handleHangUp = () => {
    peerConnectionRef.current?.close();
    wsRef.current?.close();
    setConnected(false);
    setLocalStream(null);
    setRemoteStream(null);
    window.location.reload();
  };

  return (
    <div style={{ textAlign: "center", paddingTop: "20px" }}>
      <h2>Peer-to-Peer Video Call</h2>
      <VideoContainer localStream={localStream} remoteStream={remoteStream} />
      <p>{connected ? "Connected to peer." : "Connecting..."}</p>
      <VideoControls onHangUp={handleHangUp} />
    </div>
  );
};

export default VideoCall;
