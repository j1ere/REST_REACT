// src/components/VideoContainer.jsx
import React, { useRef, useEffect } from "react";

const VideoContainer = ({ localStream, remoteStream }) => {
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [localStream, remoteStream]);

  return (
    <div style={{ display: "flex", gap: "20px" }}>
      <video ref={localVideoRef} autoPlay playsInline muted style={{ width: "300px", border: "2px solid green" }}></video>
      <video ref={remoteVideoRef} autoPlay playsInline style={{ width: "300px", border: "2px solid blue" }}></video>
    </div>
  );
};

export default VideoContainer;
