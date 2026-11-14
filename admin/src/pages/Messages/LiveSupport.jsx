import React, { useCallback, useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import { Headset, Send, RefreshCw, UserRound, Bot, MessageCircle, LoaderCircle, Bell, Search } from "lucide-react";
import { toast } from "react-toastify";
import ReactMarkdown from "react-markdown";
import { API_URL, SOCKET_URL } from "../../config/api";
import "./LiveSupport.css";

const SUPPORT_URL = `${API_URL}/api/support-chat`;

const LiveSupport = () => {
    const [conversations, setConversations] = useState([]);
    const [selectedId, setSelectedId] = useState(null);
    const [selectedConversation, setSelectedConversation] = useState(null);

    const [messages, setMessages] = useState([]);
    const [reply, setReply] = useState("");

    const [loading, setLoading] = useState(true);
    const [loadingMessages, setLoadingMessages] = useState(false);
    const [sending, setSending] = useState(false);
    const [error, setError] = useState("");

    const [unreadCounts, setUnreadCounts] = useState({});

    const [searchQuery, setSearchQuery] = useState("");
    const [conversationFilter, setConversationFilter] = useState("all");
    
    const humanConversationIdsRef = useRef(new Set());

    const totalUnread = Object.values(unreadCounts).reduce((total, count) => total + count, 0);

    // Add one unread notification to a conversation
    const addUnread = (conversationId) => {
        if(!conversationId){
            return;
        }

        // The admin is already viewing this conversation
        if(selectedIdRef.current === conversationId){
            return;
        }

        setUnreadCounts((previous) => ({
            ...previous,
            [conversationId]: (previous[conversationId] || 0) + 1
        }));
    };

    // Mark a conversation as read
    const markConversationRead = (conversationId) => {
        if(!conversationId){
            return;
        }

        setUnreadCounts((previous) => {
            if(!previous[conversationId]){
                return previous;
            }

            const updated = { ...previous };
            delete updated[conversationId];

            return updated;
        });
    };

    const [customerTyping, setCustomerTyping] = useState(false);

    const adminTypingRef = useRef(false);
    const adminTypingTimerRef = useRef(null);
    const customerTypingTimerRef = useRef(null);
    const joinedConversationRef = useRef(null);

    const socketRef = useRef(null);
    const selectedIdRef = useRef(null);
    const messagesEndRef = useRef(null);

    // Stop broadcasting admin typing
    const stopAdminTyping = () => {
        if(adminTypingTimerRef.current){
            clearTimeout(adminTypingTimerRef.current);
            adminTypingTimerRef.current = null;
        }

        if(adminTypingRef.current){
            const conversationId = selectedIdRef.current;

            if(conversationId && socketRef.current?.connected){
                socketRef.current.emit("support:typing", {
                    conversationId,
                    isTyping: false
                });
            }

            adminTypingRef.current = false;
        }
    };

    // Handle changes to the admin reply input
    const handleReplyChange = (event) => {
        const value = event.target.value;

        setReply(value);

        const conversationId = selectedIdRef.current;

        if(!conversationId || selectedConversation?.mode !== "human" || !socketRef.current?.connected || joinedConversationRef.current !== conversationId){
            return;
        }

        if(!value.trim()){
            stopAdminTyping();
            return;
        }

        if(!adminTypingRef.current){
            socketRef.current.emit("support:typing", {
                conversationId,
                isTyping: true
            });

            adminTypingRef.current = true;
        }

        // Reset inactivity timer on every input change
        if(adminTypingTimerRef.current){
            clearTimeout(adminTypingTimerRef.current);
        }

        adminTypingTimerRef.current = setTimeout(() => {
            stopAdminTyping();
        }, 1500);
    };

    const getToken = () => localStorage.getItem("adminToken");

    const apiRequest = useCallback(async (path, options = {}) => {
        const token = getToken();

        if(!token){
            throw new Error("Please login as an admin.");
        }

        const response = await fetch(`${SUPPORT_URL}${path}`, {
            ...options,
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
                ...options.headers
            }
        });

        const data = await response.json();

        if(!response.ok || !data.success){
            throw new Error(data.message || "Request failed.");
        }

        return data;
    }, []);

    // Load customer conversations
    const fetchConversations = useCallback(async () => {
        try {
            const data = await apiRequest("/admin/conversations");
            
            const list = data.conversations || [];

            setConversations(list);

            humanConversationIdsRef.current = new Set(
                list.filter((conversation) => conversation.mode === "human").map((conversation) => String(conversation._id))
            );

            setError("");
        } catch (error) {
            setError(error.message || "Failed to load conversations.");
        } finally {
            setLoading(false);
        }
    }, [apiRequest]);

    // Load a selected conversation's history
    const fetchConversationMessages = useCallback(
        async (conversationId, showLoading = true) => {
            if(!conversationId){
                return;
            }

            if(showLoading){
                setLoadingMessages(true);
            }

            try {
                const data = await apiRequest(`/admin/conversations/${conversationId}/messages`);

                // Ignore a response for a previously selected chat
                if(selectedIdRef.current !== conversationId){
                    return;
                }

                setSelectedConversation(data.conversation);
                setMessages(data.messages || []);

                if(data.conversation?.mode !== "human"){
                    stopAdminTyping();
                    setCustomerTyping(false);

                    if(customerTypingTimerRef.current){
                        clearTimeout(customerTypingTimerRef.current);
                        customerTypingTimerRef.current = null;
                    }
                }

                setError("");
            } catch (error) {
                if(selectedIdRef.current === conversationId){
                    setError(error.message || "Failed to load messages.");
                }
            } finally {
                if(showLoading){
                    setLoadingMessages(false);
                }
            }
        },
        [apiRequest]
    );

    // Select a customer conversation
    const openConversation = (conversationId) => {
        if(selectedIdRef.current === conversationId){
            return;
        }

        stopAdminTyping();

        if(customerTypingTimerRef.current){
            clearTimeout(customerTypingTimerRef.current);
            customerTypingTimerRef.current = null;
        }

        setCustomerTyping(false);
        joinedConversationRef.current = null;

        markConversationRead(conversationId);

        selectedIdRef.current = conversationId;

        setSelectedId(conversationId);
        setSelectedConversation(null);
        setMessages([]);
        setReply("");

        fetchConversationMessages(conversationId);
    }

    // Initial loading
    useEffect(() => {
        fetchConversations();
    }, [fetchConversations]);

    // Real-time Socket.IO connection
    useEffect(() => {
        const token = getToken();
        if(!token){
            return;
        }

        const socket = io(SOCKET_URL, {
            auth: {
                token,
                role: "admin"
            },
            transports: ["websocket", "polling"],
            reconnection: true
        });

        socketRef.current = socket;

        const handleConnect = () => {
            joinedConversationRef.current = null;

            fetchConversations();

            if(selectedIdRef.current){
                const conversationId = selectedIdRef.current;

                socket.emit("support:join", conversationId, (result) => {
                    if(result?.success && selectedIdRef.current === conversationId){
                        joinedConversationRef.current = conversationId;
                    }
                });

                fetchConversationMessages(conversationId, false);
            }
        };

        const handleNewMessage = (payload) => {
            if(!payload?.conversationId){
                return;
            }

            const conversationId = String(payload.conversationId);

            // Count unread human support messages
            if(payload.message?.senderType === "customer" && humanConversationIdsRef.current.has(conversationId)){
                addUnread(conversationId);
            }

            fetchConversations();

            // Update the selected conversation in real time
            if(selectedIdRef.current === conversationId && payload.message?._id){
                if(payload.message.senderType === "customer"){
                    setCustomerTyping(false);

                    if(customerTypingTimerRef.current){
                        clearTimeout(customerTypingTimerRef.current);
                        customerTypingTimerRef.current = null;
                    }
                }

                setMessages((previous) => {
                    if(previous.some((item) => item._id === payload.message._id)){
                        return previous;
                    }

                    return [...previous, payload.message];
                });
            }
        };

        const handleHumanRequest = (payload) => {
            if(!payload?.conversationId){
                return;
            }

            const conversationId = String(payload.conversationId);

            humanConversationIdsRef.current.add(conversationId);

            // Notify admin about the human support request
            addUnread(conversationId);

            fetchConversations();

            if(selectedIdRef.current === conversationId){
                fetchConversationMessages(conversationId, false);
            }
        };

        const handleModeChanged = (payload) => {
            if(!payload?.conversationId){
                return;
            }

            fetchConversations();

            if(selectedIdRef.current === payload.conversationId){
                fetchConversationMessages(payload.conversationId, false);
            }
        };

        const handleCustomerTyping = (payload) => {
            if(payload?.conversationId !== selectedIdRef.current || payload?.senderType !== "customer" || typeof payload?.isTyping !== "boolean"){
                return;
            }

            if(customerTypingTimerRef.current){
                clearTimeout(customerTypingTimerRef.current);
                customerTypingTimerRef.current = null;
            }

            setCustomerTyping(payload.isTyping);

            if(payload.isTyping){
                customerTypingTimerRef.current = setTimeout(() => {
                    setCustomerTyping(false);
                }, 3000);
            }
        };

        socket.on("connect", handleConnect);
        socket.on("support:new-message", handleNewMessage);
        socket.on("support:human-requested", handleHumanRequest);
        socket.on("support:mode-changed", handleModeChanged);
        socket.on("support:typing", handleCustomerTyping);

        socket.on("connect_error", (error) => {
            setError(
                error.message || "Real-time connection unavailable."
            );
        });

        return () => {
            socket.off("connect", handleConnect);
            socket.off("support:new-message", handleNewMessage);
            socket.off("support:human-requested", handleHumanRequest);
            socket.off("support:mode-changed", handleModeChanged);
            socket.off("support:typing", handleCustomerTyping);

            if(adminTypingTimerRef.current){
                clearTimeout(adminTypingTimerRef.current);
                adminTypingTimerRef.current = null;
            }

            if(customerTypingTimerRef.current){
                clearTimeout(customerTypingTimerRef.current);
                customerTypingTimerRef.current = null;
            }

            adminTypingRef.current = false;
            joinedConversationRef.current = null;

            socket.disconnect();

            if(socketRef.current === socket){
                socketRef.current = null;
            }
        };
    },[fetchConversations, fetchConversationMessages]);

    // Join selected conversation
    useEffect(() => {
        const socket = socketRef.current;

        if(!selectedId || !socket){
            return;
        }

        let active = true;

        socket.emit("support:join", selectedId, (result) => {
            if(active && result?.success && selectedIdRef.current === selectedId){
                joinedConversationRef.current = selectedId;
            }
        });

        return () => {
            active = false;

            if(joinedConversationRef.current === selectedId){
                joinedConversationRef.current = null;
            }

            socket.emit("support:leave", selectedId);
        };
    }, [selectedId]);

    // Scroll to latest message
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({
            behavior: "smooth",
            block: "nearest"
        });
    }, [messages, customerTyping]);

    // Admin reply
    const handleSendReply = async (event) => {
        event.preventDefault();

        const text = reply.trim();
        const conversationId = selectedIdRef.current;

        if (!text || !conversationId || sending || text.length > 2000 || selectedConversation?.mode !== "human"){
            return;
        }

        stopAdminTyping();
        setSending(true);
        setError("");

        try {
            const data = await apiRequest(
                `/admin/conversations/${conversationId}/reply`,
                {
                    method: "POST",
                    body: JSON.stringify({
                        message: text
                    })
                }
            );

            if(selectedIdRef.current === conversationId){
                setMessages((previous) => {
                    if(previous.some((item) => item._id === data.data._id)){
                        return previous;
                    }

                    return [...previous, data.data];
                });

                setReply("");
                setSelectedConversation((previous) => previous ? { ...previous, mode: "human", status: "open" } : previous);
            }

            fetchConversations();

        } catch (error) {
            toast.error(error.message || "Failed to send reply.");
        } finally {
            setSending(false);
        }
    };

    const formatTime = (date) => {
        if(!date){
            return "";
        }

        return new Date(date).toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit"
        });
    };

    // Search and filter customer conversations
    const filteredConversations = conversations.filter((conversation) => {
        const customer = conversation.customerId;

        const query = searchQuery.trim().toLowerCase();

        const customerName = String(customer?.name || "").toLowerCase();
        const customerEmail = String(customer?.email || "").toLowerCase();

        const matchesSearch = !query || customerName.includes(query) || customerEmail.includes(query);

        const unread = unreadCounts[conversation._id] || 0;

        let matchesFilter = true;

        if(conversationFilter === "unread"){
            matchesFilter = unread > 0;
        } else if (conversationFilter === "human"){
            matchesFilter = conversation.mode === "human";
        } else if (conversationFilter === "ai"){
            matchesFilter = conversation.mode === "ai";
        }

        return matchesSearch && matchesFilter;
    });

    return (
        <div className="qt-live-support">
            <div className="qt-live-header">
                <div>
                    <div className="qt-live-notification-heading">
                        <h2>Live Customer Support</h2>

                        <div className={`qt-live-notification ${totalUnread > 0 ? "has-unread" : ""}`} aria-label={`${totalUnread} unread support notifications`}>
                            <Bell size={20}/>

                            {totalUnread > 0 && (
                                <span className="qt-live-notification-count">
                                    {totalUnread > 99 ? "99+" : totalUnread}
                                </span>
                            )}
                        </div>
                    </div>

                    <p>
                        Manage customer chats and respond in real time.
                    </p>
                </div>

                <button type="button" className="qt-live-refresh" onClick={fetchConversations}>
                    <RefreshCw size={17}/>
                    Refresh
                </button>
            </div>

            {error && (
                <div className="qt-live-error" role="alert">
                    {error}
                </div>
            )}

            <div className="qt-live-layout">
                {/* Customer conversations */}
                <aside className="qt-live-inbox">
                    <div className="qt-live-inbox-header">
                        <h3>Conversations</h3>
                        <span>{conversations.length}</span>
                    </div>

                    {/* Conversation Search */}
                    <div className="qt-live-search-section">
                        <div className="qt-live-search">
                            <Search size={17}/>
                            <input type="search" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search customers..." aria-label="Search support conversations"/>
                        </div>

                        {/* Conversation Filters */}
                        <div className="qt-live-filters" role="group" aria-label="Filter conversations">
                            {[
                                {
                                    value: "all",
                                    label: "All"
                                },
                                {
                                    value: "unread",
                                    label: "Unread"
                                },
                                {
                                    value: "human",
                                    label: "Human"
                                },
                                {
                                    value: "ai",
                                    label: "AI"
                                }
                            ].map((filter) => (
                                <button key={filter.value} type="button" className={conversationFilter === filter.value ? "active" : ""} aria-pressed={conversationFilter === filter.value} onClick={() => {setConversationFilter(filter.value);}}>
                                    {filter.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="qt-live-conversation-list">
                        {loading ? (
                            <div className="qt-live-empty">
                                <LoaderCircle size={22} />
                                <p>Loading conversations...</p>
                            </div>
                        ) : filteredConversations.length === 0 ? (
                            <div className="qt-live-empty">
                                <MessageCircle size={27} />
                                <p>
                                    {conversations.length === 0 ? "No conversations yet." : "No conversations match your search or filter."}
                                </p>
                            </div>
                        ) : (
                            filteredConversations.map((conversation) => {
                                const customer = conversation.customerId;

                                const active = selectedId === conversation._id;

                                const unread = unreadCounts[conversation._id] || 0;

                                return (
                                    <button type="button" key={conversation._id} className={`qt-live-conversation ${active ? "active" : ""}`} onClick={() => openConversation(conversation._id)}>
                                        <div className="qt-live-avatar">
                                            <UserRound size={20} />
                                        </div>

                                        <div className="qt-live-conversation-info">
                                            <div className="qt-live-conversation-top">
                                                <strong>
                                                    {customer?.name || "Customer"}
                                                </strong>

                                                {unread > 0 && (
                                                    <span className="qt-live-unread-count">
                                                        {unread > 99 ? "99+" : unread}
                                                    </span>
                                                )}

                                                <small>
                                                    {formatTime(conversation.lastMessageAt)}
                                                </small>
                                            </div>

                                            <p>
                                                {(conversation.lastMessage || "New conversation").replace(/(\*\*|__)/g, "").replace(/[`#]/g, "").replace(/\s+/g, " ").trim()}
                                            </p>

                                            <span className={`qt-live-mode ${conversation.mode === "human" ? "human" : "ai"}`}>
                                                {conversation.mode === "human" ? "Human Support" : "AI Mode"}
                                            </span>
                                        </div>
                                    </button>
                                );
                            })
                        )}
                    </div>
                </aside>

                {/* Selected chat */}
                <section className="qt-live-chat">
                    {!selectedId ? (
                        <div className="qt-live-placeholder">
                            <Headset size={45} />

                            <h3>QuickTaste Live Support</h3>

                            <p>
                                Select a customer conversation to view messages and reply.
                            </p>
                        </div>
                    ) : (
                        <>
                            <header className="qt-live-chat-header">
                                <div className="qt-live-avatar">
                                    <UserRound size={22} />
                                </div>

                                <div>
                                    <h3>
                                        {selectedConversation?.customerId ?.name || "Customer"}
                                    </h3>

                                    <p>
                                        {selectedConversation?.customerId ?.email || ""}
                                    </p>
                                </div>

                                <span className="qt-live-chat-status">
                                    {selectedConversation?.mode === "human" ? "Human Support" : "AI Mode"}
                                </span>
                            </header>

                            <div className="qt-live-chat-messages">
                                {loadingMessages ? (
                                    <div className="qt-live-empty">
                                        Loading messages...
                                    </div>
                                ) : messages.length === 0 ? (
                                    <div className="qt-live-empty">
                                        No messages in this conversation.
                                    </div>
                                ) : (
                                    messages.map((message) => (
                                        <div key={message._id} className={`qt-live-bubble ${message.senderType === "admin" ? "admin" : message.senderType === "system" ? "system" : "customer"}`}>
                                            {message.senderType !== "system" && (
                                                <small>
                                                    {message.senderType === "admin" ? "Support Team" : message.senderType === "ai" ? "QuickTaste AI" : "Customer"}
                                                </small>
                                            )}

                                            <div className="qt-admin-message-content">
                                                {message.senderType === "ai" ? (
                                                    <ReactMarkdown skipHtml components={{a: ({ node, ...props }) => (<a {...props} target="_blank" rel="noopener noreferrer"/>)}}>
                                                        {message.message || ""}
                                                    </ReactMarkdown>
                                                ) : (
                                                    <p>{message.message}</p>
                                                )}
                                            </div>

                                            <time>
                                                {formatTime(message.createdAt)}
                                            </time>
                                        </div>
                                    ))
                                )}

                                {/* Customer Real-Time Typing Indicator */}
                                {customerTyping && selectedConversation?.mode === "human" && (
                                    <div className="qt-live-typing" role="status" aria-live="polite">
                                        <span className="qt-live-typing-icon">
                                            <UserRound size={17}/>
                                        </span>

                                        <span>Customer is typing</span>

                                        <div className="qt-live-typing-dots" aria-hidden="true">
                                            <span></span>
                                            <span></span>
                                            <span></span>
                                        </div>
                                    </div>
                                )}

                                <div ref={messagesEndRef} />
                            </div>

                            <div className="qt-live-chat-note">
                                <Bot size={15}/>
                                {selectedConversation?.mode === "human" ? "Human Support is active. You can reply to this customer." : "AI Support is active. Customer must request Human Support before an admin can reply."}
                            </div>

                            <form className="qt-live-chat-form" onSubmit={handleSendReply}>
                                <input type="text" value={reply} onChange={handleReplyChange} placeholder={selectedConversation?.mode === "human" ? "Write your reply..." : "Customer is currently using AI Support"} maxLength={2000} disabled={sending || loadingMessages || selectedConversation?.mode !== "human"}/>
                                <button type="submit" disabled={!reply.trim() || sending || loadingMessages || selectedConversation?.mode !== "human"}>
                                    <Send size={18}/>
                                    {sending ? "Sending..." : "Send"}
                                </button>
                            </form>
                        </>
                    )}
                </section>
            </div>
        </div>
    );
};

export default LiveSupport;
