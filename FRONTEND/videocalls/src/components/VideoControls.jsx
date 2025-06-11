// src/components/VideoControls.jsx
import React from "react";

const VideoControls = ({ onHangUp }) => {
  return (
    <div style={{ marginTop: "20px" }}>
      <button onClick={onHangUp} style={{ padding: "10px 20px", backgroundColor: "red", color: "white" }}>
        Hang Up
      </button>
    </div>
  );
};

export default VideoControls;
