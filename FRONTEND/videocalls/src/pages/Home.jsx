// src/pages/Home.jsx
import React from "react";
import { Link } from "react-router-dom";

const Home = () => {
  return (
    <div style={{ textAlign: "center", paddingTop: "50px" }}>
      <h1>Welcome to the Video Call App</h1>
      <Link to="/call">
        <button style={{ marginTop: "20px", padding: "10px 20px", fontSize: "16px" }}>
          Go to Video Call
        </button>
      </Link>
    </div>
  );
};

export default Home;
