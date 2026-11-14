import React, { useState } from "react";
import { Mail, Headset } from "lucide-react";
import Messages from "./Messages";
import LiveSupport from "./LiveSupport";
import "./LiveSupport.css";

const MessagesHub = () => {
    const [activeTab, setActiveTab] = useState("contact");

    return (
        <div className="qt-messages-hub">
            <div className="qt-messages-tabs">
                <button type="button" className={activeTab === "contact" ? "active" : ""} onClick={() => setActiveTab("contact")}>
                    <Mail size={18}/>
                    Contact Messages
                </button>

                <button type="button" className={activeTab === "live" ? "active" : ""} onClick={() => setActiveTab("live")}>
                    <Headset size={18}/>
                    Live Support
                </button>
            </div>

            {activeTab === "contact" ? (
                <Messages/>
            ) : (
                <LiveSupport/>
            )}
        </div>
    );
};

export default MessagesHub;