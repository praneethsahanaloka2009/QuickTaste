import { useContext, useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import { BotMessageSquare, X, Send, Bot, Headset, LoaderCircle } from "lucide-react";
import { StoreContext } from "../../context/StoreContext";
import ReactMarkdown from "react-markdown";
import "./SupportChat.css";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4911";
const CHAT_URL = `${API_URL}/api/support-chat`;

const SupportChat = () => {
    const { token, user } = useContext(StoreContext);

    const [isOpen, setIsOpen] = useState(false);
    const [conversation, setConversation] = useState(null);
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
    const [sending, setSending] = useState(false);
    const [error, setError] = useState("");
    const [adminTyping, setAdminTyping] = useState(false);

    const customerTypingRef = useRef(false);
    const customerTypingTimerRef = useRef(null);
    const adminTypingTimerRef = useRef(null);

    const socketRef = useRef(null);
    const messagesContainerRef = useRef(null);

    // Stop sending customer typing status
    const stopCustomerTyping = () => {
        if(customerTypingTimerRef.current){
            clearTimeout(customerTypingTimerRef.current);
            customerTypingTimerRef.current = null;
        }

        if(customerTypingRef.current){
            socketRef.current?.emit("support:typing", {
                conversationId: conversation?._id,
                isTyping: false
            });

            customerTypingRef.current = false;
        }
    };

    // Notify admin while customer is typing
    const handleInputChange = (event) => {
        const value = event.target.value;
        setInput(value);

        if(conversation?.mode !== "human" || !conversation?._id || !socketRef.current?.connected){
            return;
        }

        if(!value.trim()){
            stopCustomerTyping();
            return;
        };

        // Emit start only once per typing session
        if(!customerTypingRef.current){
            socketRef.current.emit("support:typing", {
                conversationId: conversation._id,
                isTyping: true
            });

            customerTypingRef.current = true;
        }

        // Stop after 1.5 seconds of inactivity
        if(customerTypingTimerRef.current){
            clearTimeout(customerTypingTimerRef.current);
        }
        
        customerTypingTimerRef.current = setTimeout(() => {
            stopCustomerTyping();
        }, 1500);
    };

    const addMessage = (incoming) => {
        if(!incoming?._id){
            return;
        }

        setMessages((previous) => {
            if(previous.some((m) => m._id === incoming._id)){
                return previous;
            }

            return [...previous, incoming].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
        });
    };

    // Load or create customer's conversation
    useEffect(() => {
        if(!isOpen || !token){
            return;
        }

        let cancelled = false;

        const loadChat = async () => {
            setLoading(true);
            setError("");

            try {
                const headers = {
                    Authorization: `Bearer ${token}`
                };

                const startResponse = await fetch(
                    `${CHAT_URL}/customer/start`,
                    {
                        method: "POST",
                        headers
                    }
                );

                const startData = await startResponse.json();

                if(!startResponse.ok || !startData.success){
                    throw new Error(startData.message || "Unable to start chat.");
                }

                const historyResponse = await fetch(
                    `${CHAT_URL}/customer/messages`,
                    {
                        headers
                    }
                );

                const historyData = await historyResponse.json();

                if(!historyResponse.ok || !historyData.success){
                    throw new Error(historyData.message || "Unable to load chat.");
                }

                if(cancelled){
                    return;
                }

                setConversation(
                    historyData.conversation || startData.conversation
                );

                setMessages(historyData.messages || []);

            } catch (error) {
                if(!cancelled){
                    setError(error.message || "Connection failed.");
                }
            } finally {
                if(!cancelled){
                    setLoading(false);
                }
            }
        };

        loadChat();

        return () => {
            cancelled = true;
        };
    }, [isOpen, token]);

    // Connect authenticated Socket.IO client
    useEffect(() => {
        if(!isOpen || !token || !conversation?._id){
            return;
        }

        const socket = io(API_URL, {
            auth: {
                token,
                role: "customer"
            },
            transports: ["websocket", "polling"],
            reconnection: true
        });

        socketRef.current = socket;

        const joinConversation = () => {
            socket.emit(
                "support:join",
                conversation._id,
                (result) => {
                    if(!result?.success){
                        setError(result?.message || "Unable to join live chat.");
                    }
                }
            );
        };

        const handleNewMessage = (payload) => {
            if(payload?.conversationId === conversation._id){
                addMessage(payload.message);
            }
        };

        const handleHumanRequest = (payload) => {
            if(payload?.conversationId === conversation._id){
                setConversation((previous) => previous ? { ...previous, mode: "human" } : previous);

                addMessage(payload.systemMessage);
            }
        };

        const handleModeChanged = (payload) => {
            if(payload?.conversationId !== conversation._id){
                return;
            }

            setConversation((previous) => previous ? { ...previous, mode: "ai" } : previous);

            if(payload.systemMessage){
                addMessage(payload.systemMessage);
            }
        };

        const handleTyping = (payload) => {
            if(payload?.conversationId !== conversation._id || payload?.senderType !== "admin"){
                return;
            }

            if(adminTypingTimerRef.current){
                clearTimeout(adminTypingTimerRef.current);
                adminTypingTimerRef.current = null;
            }

            setAdminTyping(payload.isTyping === true);

            // Prevent an indicator staying visible indefinitely
            if(payload.isTyping === true){
                adminTypingTimerRef.current = setTimeout(() => {
                    setAdminTyping(false);
                }, 3000);
            }
        }

        socket.on("connect", joinConversation);
        socket.on("support:new-message", handleNewMessage);
        socket.on("support:human-requested", handleHumanRequest);
        socket.on("support:mode-changed", handleModeChanged);
        socket.on("support:typing", handleTyping);

        socket.on("connect_error", (err) => {
            setError(err.message || "Live connection unavailable.");
        });

        return () => {
            socket.off("connect", joinConversation);
            socket.off("support:new-message", handleNewMessage);
            socket.off("support:human-requested", handleHumanRequest);
            socket.off("support:mode-changed", handleModeChanged);
            socket.off("support:typing", handleTyping);

            if(customerTypingTimerRef.current){
                clearTimeout(customerTypingTimerRef.current);
                customerTypingTimerRef.current = null;
            }

            customerTypingRef.current = false;

            if(adminTypingTimerRef.current){
                clearTimeout(adminTypingTimerRef.current);
                adminTypingTimerRef.current = null;
            }

            setAdminTyping(false);

            socket.disconnect();

            if(socketRef.current === socket){
                socketRef.current = null;
            }
        };
    }, [isOpen, token, conversation?._id]);

    // Auto-scroll when messages or typing state changes
    useEffect(() => {
        if(!isOpen){
            return;
        }

        const container = messagesContainerRef.current;

        if(!container){
            return;
        }

        container.scrollTo({
            top: container.scrollHeight,
            behavior: "smooth"
        });

    }, [messages, isOpen, sending, conversation?.mode, adminTyping]);

    const sendMessage = async (event) => {
        event.preventDefault();

        const text = input.trim();

        if(!text || !conversation || sending || text.length > 2000){
            return;
        }

        stopCustomerTyping();
        setSending(true);
        setError("");

        try {
            const response = await fetch(
                `${CHAT_URL}/customer/send`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        message: text
                    })
                }
            );

            const data = await response.json();

            if(!response.ok || !data.success){
                throw new Error(data.message || "Unable to send.");
            }

            addMessage(data.data);

            if(data.aiMessage){
                addMessage(data.aiMessage);
            }

            if(data.aiUnavailable){
                setError("AI support is temporarily unavailable. Please try again or contact human support.");
            }

            setInput("");

        } catch (error) {
            setError(error.message || "Message sending failed.");
        } finally {
            setSending(false);
        }
    };

    const requestHuman = async () => {
        if(!conversation || loading){
            return;
        }

        setLoading(true);
        setError("");

        try {
            const response = await fetch(
                `${CHAT_URL}/customer/request-human`,
                {
                    method: "POST",
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                }
            );

            const data = await response.json();

            if(!response.ok || !data.success){
                throw new Error(data.message || "Unable to request support.");
            }

            setConversation(data.conversation);
            addMessage(data.systemMessage);

        } catch (error) {
            setError(error.message || "Request failed.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if(conversation?.mode !== "human"){
            stopCustomerTyping();
            setAdminTyping(false);
        }
    }, [conversation?.mode]);

    // Chat available to logged-in customers
    if(!token){
        return null;
    }

    /* Switch from Human Support to Gemini AI */
    const switchToAI = async () => {
        if(!conversation || loading || sending){
            return;
        }

        setLoading(true);
        setError("");

        try {
            const response = await fetch(
                `${CHAT_URL}/customer/switch-to-ai`,
                {
                    method: "POST",
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                }
            );

            const data = await response.json();

            if(!response.ok || !data.success){
                throw new Error(data.message || "Unable to switch to AI Support.");
            }

            setConversation(data.conversation);

            if(data.systemMessage){
                addMessage(data.systemMessage);
            }

        } catch (error) {
            setError(error.message || "Unable to switch to AI Support.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="qt-support-root">
            {!isOpen && (
                <button type="button" className="qt-support-fab" onClick={() => setIsOpen(true)} aria-label="Open QuickTaste support chat">
                    <BotMessageSquare size={27}/>
                </button>
            )}

            {isOpen && (
                <section className="qt-support-panel">
                    <header className="qt-support-header">
                        <div className="qt-support-heading">
                            <span className="qt-support-header-icon">
                                <Headset size={22}/>
                            </span>

                            <div>
                                <h3>QuickTaste Support</h3>
                                <p>
                                    {conversation?.mode === "human" ? "Human Support" : "AI Assistant Mode"}
                                </p>
                            </div>
                        </div>

                        <button type="button" onClick={() => {stopCustomerTyping(); setIsOpen(false)}} aria-label="Close support chat">
                            <X size={21}/>
                        </button>
                    </header>

                    <div className="qt-support-messages" ref={messagesContainerRef}>
                        <div className="qt-support-welcome">
                            <Bot size={28}/>

                            <h4>
                                Hello{user?.name ? `, ${user.name.split(" ")[0]}` : ""}!
                            </h4>

                            <p>
                                Welcome to QuickTaste Support. Send us a message or request help from our support team.
                            </p>
                        </div>

                        {loading && !conversation && (
                            <div className="qt-support-loading">
                                <LoaderCircle size={20}/>
                                <span>Loading conversation...</span>
                            </div>
                        )}

                        {messages.map((msg) => (
                            <div key={msg._id} className={`qt-support-message ${msg.senderType === "customer" ? "customer" : msg.senderType === "system" ? "system" : "support"}`}>
                                {msg.senderType !== "customer" && msg.senderType !== "system" && (
                                    <small>
                                        {msg.senderType === "ai" ? msg.message?.startsWith("QuickTaste Automated FAQ") ? "QuickTaste FAQ Bot" : "QuickTaste AI" : "Support Team"}
                                    </small>
                                )}

                                <div className="qt-support-message-content">
                                    {msg.senderType === "ai" ? (
                                        <ReactMarkdown skipHtml components={{a: ({ node, ...props }) => (<a {...props} target="_blank" rel="noopener noreferrer"/>)}}>
                                            {msg.message || ""}
                                        </ReactMarkdown>
                                    ) : (
                                        <p>{msg.message}</p>
                                    )}
                                </div>
                            </div>
                        ))}

                        {/* Gemini AI / FAQ Bot Typing Indicator */}
                        {sending && conversation?.mode === "ai" && (
                            <div className="qt-support-typing" role="status" aria-live="polite">
                                <div className="qt-support-typing-avatar">
                                    <Bot size={18}/>
                                </div>

                                <div className="qt-support-typing-content">
                                    <span className="qt-support-typing-title">
                                        QuickTaste AI
                                    </span>

                                    <div className="qt-support-typing-row">
                                        <span className="qt-support-typing-text">
                                            Generating a response
                                        </span>

                                        <div className="qt-support-typing-dots" aria-hidden="true">
                                            <span></span>
                                            <span></span>
                                            <span></span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Human Support - Admin Typing Indicator */}
                        {adminTyping && conversation?.mode === "human" && (
                            <div className="qt-support-typing" role="status" aria-live="polite">
                                <div className="qt-support-typing-avatar">
                                    <Headset size={18}/>
                                </div>

                                <div className="qt-support-typing-content">
                                    <span className="qt-support-typing-title">
                                        Support Team
                                    </span>

                                    <div className="qt-support-typing-row">
                                        <span className="qt-support-typing-text">
                                            Support Team is typing
                                        </span>

                                        <div className="qt-support-typing-dots" aria-hidden="true">
                                            <span></span>
                                            <span></span>
                                            <span></span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {error && (
                        <div className="qt-support-error" role="alert">
                            {error}
                        </div>
                    )}

                    {/* AI Assistant / Human Support Mode Switcher */}
                    <div className="qt-support-actions qt-support-mode-options">
                        
                        {/* AI Assistant */}
                        <button type="button" className={`qt-support-mode-btn ${conversation?.mode === "ai" ? "active" : ""}`} onClick={switchToAI} disabled={!conversation || loading || sending || conversation?.mode === "ai"} aria-pressed={conversation?.mode === "ai"}>
                            <span className="qt-support-mode-label">
                                <Bot size={18}/>
                                AI Assistant
                            </span>

                            {conversation?.mode === "ai" && (
                                <span className="qt-support-mode-status">
                                    Active
                                </span>
                            )}
                        </button>

                        {/* Human Support */}
                        <button type="button" className={`qt-support-mode-btn ${conversation?.mode === "human" ? "active" : ""}`} onClick={requestHuman} disabled={!conversation || loading || sending || conversation?.mode === "human"} aria-pressed={conversation?.mode === "human"}>
                            <span className="qt-support-mode-label">
                                <Headset size={18}/>
                                Human Support
                            </span>

                            {conversation?.mode === "human" && (
                                <span className="qt-support-mode-status">
                                    Active
                                </span>
                            )}
                        </button>

                    </div>

                    <form className="qt-support-form" onSubmit={sendMessage}>
                        <input type="text" value={input} onChange={handleInputChange} placeholder="Type your message..." maxLength={2000} disabled={!conversation || sending || loading} aria-label="Chat message"/>
                        
                        <button type="submit" disabled={!conversation || !input.trim() || sending || loading} aria-label="Send message">
                            <Send size={19}/>
                        </button>
                    </form>

                    <div className="qt-support-footer">
                        {conversation?.mode === "human" ? "Connected to QuickTaste Human Support" : "Powered by QuickTaste AI Assistant"}
                    </div>
                </section>
            )}
        </div>
    );
};

export default SupportChat;