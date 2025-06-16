import React, { useEffect, useRef, useState } from "react";
import VideoContainer from "./VideoContainer";
import VideoControls from "./VideoControls";

const VideoCall = () => {
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [connected, setConnected] = useState(false);
  const [isOfferer, setIsOfferer] = useState(false);

  const peerConnectionRef = useRef(null);
  const wsRef = useRef(null);

  useEffect(() => {
    let isMounted = true;

    const startWebRTC = async () => {
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error("MediaDevices API not available. Ensure HTTPS and browser support.");
        }
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true }).catch((error) => {
          throw new Error(`getUserMedia failed: ${error.name} - ${error.message}`);
        });
        if (!isMounted) return;
        setLocalStream(stream);

        const ws = new WebSocket("wss://192.168.165.61:8001/ws/signaling/");
        wsRef.current = ws;

        const peerConnection = new RTCPeerConnection({
          iceServers: [
            { urls: "stun:stun.l.google.com:19302" },
            // Add TURN server here
            // {
            //   urls: "turn:numb.viagenie.ca",
            //   username: "your-email@example.com",
            //   credential: "your-password",
            // },
          ],
        });
        peerConnectionRef.current = peerConnection;

        let remoteDescriptionSet = false;
        const iceQueue = [];

        stream.getTracks().forEach((track) => peerConnection.addTrack(track, stream));

        peerConnection.onicecandidate = (event) => {
          if (event.candidate && wsRef.current?.readyState === WebSocket.OPEN) {
            console.log("Sending ICE candidate:", event.candidate);
            wsRef.current.send(JSON.stringify({ type: "ice", candidate: event.candidate }));
          }
        };

        peerConnection.ontrack = (event) => {
          if (!isMounted) return;
          console.log("Received track:", event.track);
          if (!remoteStream) {
            const inboundStream = new MediaStream();
            inboundStream.addTrack(event.track);
            console.log("Setting new remote stream with track:", event.track);
            setRemoteStream(inboundStream);
          } else {
            setRemoteStream((prev) => {
              if (!prev.getTracks().includes(event.track)) {
                prev.addTrack(event.track);
                console.log("Added track to existing remote stream:", event.track);
              }
              return prev;
            });
          }
        };

        peerConnection.oniceconnectionstatechange = () => {
          console.log("ICE connection state:", peerConnection.iceConnectionState);
        };
        peerConnection.onsignalingstatechange = () => {
          console.log("Signaling state:", peerConnection.signalingState);
        };

        ws.onmessage = async (event) => {
          if (!isMounted || !peerConnectionRef.current || peerConnectionRef.current.signalingState === "closed") {
            console.warn("Peer connection is closed or unmounted, ignoring message");
            return;
          }

          const data = JSON.parse(event.data);
          console.log("Received WebSocket message:", data);

          if (data.type === "offer") {
            console.log("Received offer:", data.offer);
            await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(data.offer));
            remoteDescriptionSet = true;

            const answer = await peerConnectionRef.current.createAnswer();
            await peerConnectionRef.current.setLocalDescription(answer);
            console.log("Sending answer:", answer);
            if (wsRef.current?.readyState === WebSocket.OPEN) {
              wsRef.current.send(JSON.stringify({ type: "answer", answer }));
            }
            setConnected(true);

            for (const candidate of iceQueue) {
              await peerConnectionRef.current.addIceCandidate(candidate);
            }
          } else if (data.type === "answer") {
            console.log("Received answer:", data.answer);
            await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(data.answer));
            remoteDescriptionSet = true;
            setConnected(true);

            for (const candidate of iceQueue) {
              await peerConnectionRef.current.addIceCandidate(candidate);
            }
          } else if (data.type === "ice") {
            const candidate = new RTCIceCandidate(data.candidate);
            console.log("Received ICE candidate:", candidate);
            if (remoteDescriptionSet) {
              if (
                peerConnectionRef.current.signalingState !== "closed" &&
                peerConnectionRef.current.iceConnectionState !== "closed"
              ) {
                try {
                  await peerConnectionRef.current.addIceCandidate(candidate);
                  console.log("Added ICE candidate successfully");
                } catch (e) {
                  console.error("Error adding ICE candidate", e);
                }
              }
            } else {
              iceQueue.push(candidate);
              console.log("Queued ICE candidate:", candidate);
            }
          }
        };

        if (isOfferer) {
          const offer = await peerConnection.createOffer();
          await peerConnection.setLocalDescription(offer);
          console.log("Sending offer:", offer);
          if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ type: "offer", offer }));
          }
        }
      } catch (error) {
        if (isMounted) {
          console.error("Error in startWebRTC:", error);
          alert(`Failed to start video call: ${error.message}`);
        }
      }
    };

    startWebRTC();

    return () => {
      isMounted = false;
      if (localStream) {
        localStream.getTracks().forEach((track) => track.stop());
      }
      if (remoteStream) {
        remoteStream.getTracks().forEach((track) => track.stop());
      }
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
        peerConnectionRef.current = null;
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [isOfferer]);

  const handleHangUp = () => {
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    if (localStream) {
      localStream.getTracks().forEach((track) => track.stop());
    }
    if (remoteStream) {
      remoteStream.getTracks().forEach((track) => track.stop());
    }
    setConnected(false);
    setLocalStream(null);
    setRemoteStream(null);
    setIsOfferer(false);
  };

  const startCall = () => {
    setIsOfferer(true);
  };

  return (
    <div style={{ textAlign: "center", paddingTop: "20px" }}>
      <h2>Peer-to-Peer Video Call</h2>
      {!isOfferer && !connected && (
        <button onClick={startCall} style={{ padding: "10px 20px", marginBottom: "10px" }}>
          Start Call
        </button>
      )}
      <VideoContainer localStream={localStream} remoteStream={remoteStream} />
      <p>{connected ? "Connected to peer." : "Connecting..."}</p>
      <VideoControls onHangUp={handleHangUp} />
    </div>
  );
};

export default VideoCall;























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














// // src/components/VideoCall.jsx
// import React, { useEffect, useRef, useState } from "react";
// import VideoContainer from "./VideoContainer";
// import VideoControls from "./VideoControls";

// const VideoCall = () => {
//   const [localStream, setLocalStream] = useState(null);
//   const [remoteStream, setRemoteStream] = useState(null);
//   const [connected, setConnected] = useState(false);

//   const peerConnectionRef = useRef(null);
//   const wsRef = useRef(null);

//   useEffect(() => {
//     const startWebRTC = async () => {
//       const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
//       setLocalStream(stream);

//       const ws = new WebSocket("ws://localhost:8000/ws/signaling/");
//       wsRef.current = ws;

//       const peerConnection = new RTCPeerConnection({
//         iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
//       });
//       peerConnectionRef.current = peerConnection;

//         //   track if remoteDescription is set
//         let remoteDescriptionSet = false;
//         const iceQueue = [];

//       stream.getTracks().forEach((track) => peerConnection.addTrack(track, stream));

//       peerConnection.onicecandidate = (event) => {
//         // if (event.candidate) {
//         //   ws.send(JSON.stringify({ type: "ice", candidate: event.candidate }));
//         // }

//             if (event.candidate && ws.readyState === WebSocket.OPEN){
//                 ws.send(JSON.stringify({type: "ice", candidate: event.candidate}));
//             }
//       };


//       peerConnection.ontrack = (event) => {
//         if (!remoteStream) {
//           const inboundStream = new MediaStream();
//           //   added
//           inboundStream.addTrack(event.track)
//           setRemoteStream(inboundStream);
//         } else {
//         setRemoteStream((prev) => {
//           if (!prev.getTracks().includes(event.track)) {
//             prev.addTrack(event.track);
//           }
//           return prev;
//         });
//         }
//       };

//       ws.onmessage = async (event) => {
//         const data = JSON.parse(event.data);

//         if (data.type === "offer") {
//           await peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer));
//           //   added
//           remoteDescriptionSet = true;


//           const answer = await peerConnection.createAnswer();
//           await peerConnection.setLocalDescription(answer);
//           ws.send(JSON.stringify({ type: "answer", answer }));
//           setConnected(true);

//         //   flush queued ICE candidates
//         for (const candidate of iceQueue){
//             await peerConnection.addIceCandidate(candidate);
//         }


//         } else if (data.type === "answer") {
//           await peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
//         //   added
//           remoteDescriptionSet = true;
//           setConnected(true);

//           //   flush queued ICE candidates
//         for (const candidate of iceQueue){
//             await peerConnection.addIceCandidate(candidate);
//         }


//         } else if (data.type === "ice") {
//             // added
//             const candidate = new RTCIceCandidate(data.candidate);
//             if(remoteDescriptionSet){
//                 if(
//                     peerConnection.signalingState !== "closed" &&
//                     peerConnection.iceConnectionState !== "closed"

//                 ){
//                      try {
//                         await peerConnection.addIceCandidate(candidate);
//                     } catch (e) {
//                         console.error("Error adding ICE candidate", e);
//                     }

//                 }
                               
//             }else{
//                 iceQueue.push(candidate);
//             }       
//         }
//       };

//       // send offer  
//       const offer = await peerConnection.createOffer();
//       await peerConnection.setLocalDescription(offer);
//       ws.send(JSON.stringify({ type: "offer", offer }));
//     };

//     startWebRTC();

//     return () => {
//       wsRef.current?.close();
//       peerConnectionRef.current?.close();

//       localStream?.getTracks().forEach((track) => track.stop());
//       remoteStream?.getTracks().forEach((track) => track.stop());
//       wsRef.current?.close();
//       peerConnectionRef.current?.close();
//     };
//   }, []);

//   const handleHangUp = () => {
//     peerConnectionRef.current?.close();
//     wsRef.current?.close();
//     setConnected(false);
//     setLocalStream(null);
//     setRemoteStream(null);
//     window.location.reload();
//   };

//   return (
//     <div style={{ textAlign: "center", paddingTop: "20px" }}>
//       <h2>Peer-to-Peer Video Call</h2>
//       <VideoContainer localStream={localStream} remoteStream={remoteStream} />
//       <p>{connected ? "Connected to peer." : "Connecting..."}</p>
//       <VideoControls onHangUp={handleHangUp} />
//     </div>
//   );
// };

// export default VideoCall;

// import React, { useEffect, useRef, useState } from "react";
// import VideoContainer from "./VideoContainer";
// import VideoControls from "./VideoControls";

// const VideoCall = () => {
//   const [localStream, setLocalStream] = useState(null);
//   const [remoteStream, setRemoteStream] = useState(null);
//   const [connected, setConnected] = useState(false);

//   const peerConnectionRef = useRef(null);
//   const wsRef = useRef(null);

//   useEffect(() => {
//     let isMounted = true;

//     const startWebRTC = async () => {
//       try {
//         const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
//         if (!isMounted) return;
//         setLocalStream(stream);

//         const ws = new WebSocket("ws://localhost:8000/ws/signaling/");
//         wsRef.current = ws;

//         const peerConnection = new RTCPeerConnection({
//           iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
//         });
//         peerConnectionRef.current = peerConnection;

//         let remoteDescriptionSet = false;
//         const iceQueue = [];

//         stream.getTracks().forEach((track) => peerConnection.addTrack(track, stream));

//         peerConnection.onicecandidate = (event) => {
//           if (event.candidate && wsRef.current?.readyState === WebSocket.OPEN) {
//             wsRef.current.send(JSON.stringify({ type: "ice", candidate: event.candidate }));
//           }
//         };

//         peerConnection.ontrack = (event) => {
//           if (!isMounted) return;
//           if (!remoteStream) {
//             const inboundStream = new MediaStream();
//             inboundStream.addTrack(event.track);
//             setRemoteStream(inboundStream);
//           } else {
//             setRemoteStream((prev) => {
//               if (!prev.getTracks().includes(event.track)) {
//                 prev.addTrack(event.track);
//               }
//               return prev;
//             });
//           }
//         };

//         ws.onmessage = async (event) => {
//           if (!isMounted || !peerConnectionRef.current || peerConnectionRef.current.signalingState === "closed") {
//             console.warn("Peer connection is closed or unmounted, ignoring message");
//             return;
//           }

//           const data = JSON.parse(event.data);

//           if (data.type === "offer") {
//             await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(data.offer));
//             remoteDescriptionSet = true;

//             const answer = await peerConnectionRef.current.createAnswer();
//             await peerConnectionRef.current.setLocalDescription(answer);
//             if (wsRef.current?.readyState === WebSocket.OPEN) {
//               wsRef.current.send(JSON.stringify({ type: "answer", answer }));
//             }
//             setConnected(true);

//             for (const candidate of iceQueue) {
//               await peerConnectionRef.current.addIceCandidate(candidate);
//             }
//           } else if (data.type === "answer") {
//             await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(data.answer));
//             remoteDescriptionSet = true;
//             setConnected(true);

//             for (const candidate of iceQueue) {
//               await peerConnectionRef.current.addIceCandidate(candidate);
//             }
//           } else if (data.type === "ice") {
//             const candidate = new RTCIceCandidate(data.candidate);
//             if (remoteDescriptionSet) {
//               if (
//                 peerConnectionRef.current.signalingState !== "closed" &&
//                 peerConnectionRef.current.iceConnectionState !== "closed"
//               ) {
//                 try {
//                   await peerConnectionRef.current.addIceCandidate(candidate);
//                 } catch (e) {
//                   console.error("Error adding ICE candidate", e);
//                 }
//               }
//             } else {
//               iceQueue.push(candidate);
//             }
//           }
//         };

//         const offer = await peerConnection.createOffer();
//         await peerConnection.setLocalDescription(offer);
//         if (wsRef.current?.readyState === WebSocket.OPEN) {
//           wsRef.current.send(JSON.stringify({ type: "offer", offer }));
//         }
//       } catch (error) {
//         if (isMounted) console.error("Error in startWebRTC:", error);
//       }
//     };

//     startWebRTC();

//     return () => {
//       isMounted = false;
//       if (localStream) {
//         localStream.getTracks().forEach((track) => track.stop());
//       }
//       if (remoteStream) {
//         remoteStream.getTracks().forEach((track) => track.stop());
//       }
//       if (peerConnectionRef.current) {
//         peerConnectionRef.current.close();
//         peerConnectionRef.current = null;
//       }
//       if (wsRef.current) {
//         wsRef.current.close();
//         wsRef.current = null;
//       }
//     };
//   }, []);

//   const handleHangUp = () => {
//     if (peerConnectionRef.current) {
//       peerConnectionRef.current.close();
//       peerConnectionRef.current = null;
//     }
//     if (wsRef.current) {
//       wsRef.current.close();
//       wsRef.current = null;
//     }
//     if (localStream) {
//       localStream.getTracks().forEach((track) => track.stop());
//     }
//     if (remoteStream) {
//       remoteStream.getTracks().forEach((track) => track.stop());
//     }
//     setConnected(false);
//     setLocalStream(null);
//     setRemoteStream(null);
//   };

//   return (
//     <div style={{ textAlign: "center", paddingTop: "20px" }}>
//       <h2>Peer-to-Peer Video Call</h2>
//       <VideoContainer localStream={localStream} remoteStream={remoteStream} />
//       <p>{connected ? "Connected to peer." : "Connecting..."}</p>
//       <VideoControls onHangUp={handleHangUp} />
//     </div>
//   );
// };

// export default VideoCall;




// import React, { useEffect, useRef, useState } from "react";
// import VideoContainer from "./VideoContainer";
// import VideoControls from "./VideoControls";

// const VideoCall = () => {
//   const [localStream, setLocalStream] = useState(null);
//   const [remoteStream, setRemoteStream] = useState(null);
//   const [connected, setConnected] = useState(false);
//   const [isOfferer, setIsOfferer] = useState(false);

//   const peerConnectionRef = useRef(null);
//   const wsRef = useRef(null);

//   useEffect(() => {
//     let isMounted = true;

//     const startWebRTC = async () => {
//       try {
//         const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
//         if (!isMounted) return;
//         setLocalStream(stream);

//         const ws = new WebSocket("wss://10.186.3.187:8000/ws/signaling/");
//         wsRef.current = ws;

//         const peerConnection = new RTCPeerConnection({
//           iceServers: [
//             { urls: "stun:stun.l.google.com:19302" },
//             // Add TURN server here, e.g.:
//             // {
//             //   urls: "turn:numb.viagenie.ca",
//             //   username: "your-email@example.com",
//             //   credential: "your-password",
//             // },
//           ],
//         });
//         peerConnectionRef.current = peerConnection;

//         let remoteDescriptionSet = false;
//         const iceQueue = [];

//         stream.getTracks().forEach((track) => peerConnection.addTrack(track, stream));

//         peerConnection.onicecandidate = (event) => {
//           if (event.candidate && wsRef.current?.readyState === WebSocket.OPEN) {
//             console.log("Sending ICE candidate:", event.candidate);
//             wsRef.current.send(JSON.stringify({ type: "ice", candidate: event.candidate }));
//           }
//         };

//         peerConnection.ontrack = (event) => {
//           if (!isMounted) return;
//           console.log("Received track:", event.track);
//           if (!remoteStream) {
//             const inboundStream = new MediaStream();
//             inboundStream.addTrack(event.track);
//             console.log("Setting new remote stream with track:", event.track);
//             setRemoteStream(inboundStream);
//           } else {
//             setRemoteStream((prev) => {
//               if (!prev.getTracks().includes(event.track)) {
//                 prev.addTrack(event.track);
//                 console.log("Added track to existing remote stream:", event.track);
//               }
//               return prev;
//             });
//           }
//         };

//         peerConnection.oniceconnectionstatechange = () => {
//           console.log("ICE connection state:", peerConnection.iceConnectionState);
//         };
//         peerConnection.onsignalingstatechange = () => {
//           console.log("Signaling state:", peerConnection.signalingState);
//         };

//         ws.onmessage = async (event) => {
//           if (!isMounted || !peerConnectionRef.current || peerConnectionRef.current.signalingState === "closed") {
//             console.warn("Peer connection is closed or unmounted, ignoring message");
//             return;
//           }

//           const data = JSON.parse(event.data);

//           if (data.type === "offer") {
//             await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(data.offer));
//             remoteDescriptionSet = true;

//             const answer = await peerConnectionRef.current.createAnswer();
//             await peerConnectionRef.current.setLocalDescription(answer);
//             if (wsRef.current?.readyState === WebSocket.OPEN) {
//               wsRef.current.send(JSON.stringify({ type: "answer", answer }));
//             }
//             setConnected(true);

//             for (const candidate of iceQueue) {
//               await peerConnectionRef.current.addIceCandidate(candidate);
//             }
//           } else if (data.type === "answer") {
//             await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(data.answer));
//             remoteDescriptionSet = true;
//             setConnected(true);

//             for (const candidate of iceQueue) {
//               await peerConnectionRef.current.addIceCandidate(candidate);
//             }
//           } else if (data.type === "ice") {
//             const candidate = new RTCIceCandidate(data.candidate);
//             console.log("Received ICE candidate:", candidate);
//             if (remoteDescriptionSet) {
//               if (
//                 peerConnectionRef.current.signalingState !== "closed" &&
//                 peerConnectionRef.current.iceConnectionState !== "closed"
//               ) {
//                 try {
//                   await peerConnectionRef.current.addIceCandidate(candidate);
//                   console.log("Added ICE candidate successfully");
//                 } catch (e) {
//                   console.error("Error adding ICE candidate", e);
//                 }
//               }
//             } else {
//               iceQueue.push(candidate);
//               console.log("Queued ICE candidate:", candidate);
//             }
//           }
//         };

//         if (isOfferer) {
//           const offer = await peerConnection.createOffer();
//           await peerConnection.setLocalDescription(offer);
//           if (wsRef.current?.readyState === WebSocket.OPEN) {
//             wsRef.current.send(JSON.stringify({ type: "offer", offer }));
//           }
//         }
//       } catch (error) {
//         if (isMounted) console.error("Error in startWebRTC:", error);
//       }
//     };

//     startWebRTC();

//     return () => {
//       isMounted = false;
//       if (localStream) {
//         localStream.getTracks().forEach((track) => track.stop());
//       }
//       if (remoteStream) {
//         remoteStream.getTracks().forEach((track) => track.stop());
//       }
//       if (peerConnectionRef.current) {
//         peerConnectionRef.current.close();
//         peerConnectionRef.current = null;
//       }
//       if (wsRef.current) {
//         wsRef.current.close();
//         wsRef.current = null;
//       }
//     };
//   }, [isOfferer]);

//   const handleHangUp = () => {
//     if (peerConnectionRef.current) {
//       peerConnectionRef.current.close();
//       peerConnectionRef.current = null;
//     }
//     if (wsRef.current) {
//       wsRef.current.close();
//       wsRef.current = null;
//     }
//     if (localStream) {
//       localStream.getTracks().forEach((track) => track.stop());
//     }
//     if (remoteStream) {
//       remoteStream.getTracks().forEach((track) => track.stop());
//     }
//     setConnected(false);
//     setLocalStream(null);
//     setRemoteStream(null);
//     setIsOfferer(false);
//   };

//   const startCall = () => {
//     setIsOfferer(true);
//   };

//   return (
//     <div style={{ textAlign: "center", paddingTop: "20px" }}>
//       <h2>Peer-to-Peer Video Call</h2>
//       {!isOfferer && !connected && (
//         <button onClick={startCall} style={{ padding: "10px 20px", marginBottom: "10px" }}>
//           Start Call
//         </button>
//       )}
//       <VideoContainer localStream={localStream} remoteStream={remoteStream} />
//       <p>{connected ? "Connected to peer." : "Connecting..."}</p>
//       <VideoControls onHangUp={handleHangUp} />
//     </div>
//   );
// };

// export default VideoCall;