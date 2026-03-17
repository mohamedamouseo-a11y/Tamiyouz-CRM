import React, { useState, useEffect } from 'react';
import { trpc } from '@/lib/trpc';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { format } from 'date-fns';
import { useLanguage } from '@/contexts/LanguageContext';
import { MessageSquare, ShieldAlert } from 'lucide-react';
import { io } from 'socket.io-client';

export default function ChatMonitor() {
  const { isRTL } = useLanguage();
  const { data: conversations, refetch } = trpc.chat.getConversations.useQuery();
  const [liveMessages, setLiveMessages] = useState<any[]>([]);

  useEffect(() => {
    const socket = io({ path: "/api/chat/socket.io" });
    
    socket.on("monitor_message", (msg) => {
      setLiveMessages((prev) => [msg, ...prev].slice(0, 50));
      refetch();
    });

    return () => {
      socket.disconnect();
    };
  }, [refetch]);

  return (
    <div className="space-y-6 p-6" dir={isRTL ? "rtl" : "ltr"}>
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <ShieldAlert className="text-primary" />
          {isRTL ? "رقابة شات أبطال المبيعات" : "Sales Heroes Chat Monitoring"}
        </h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <MessageSquare size={18} />
              {isRTL ? "آخر المحادثات" : "Latest Conversations"}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[600px]">
              <div className="divide-y">
                {(conversations ?? []).map((conv: any) => (
                  <div key={conv.id} className="p-4 hover:bg-muted/50 transition-colors">
                    <div className="flex justify-between items-start mb-1">
                      <div className="font-semibold text-sm">
                        {conv.fromUserName} ↔ {conv.toUserName}
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        {format(new Date(conv.createdAt), 'dd/MM HH:mm')}
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground truncate italic">
                      "{conv.content}"
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        <Card className="md:col-span-2 border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
              </span>
              {isRTL ? "بث مباشر للرسائل" : "Live Message Stream"}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[600px]">
              <div className="p-4 space-y-4">
                {liveMessages.length === 0 && (
                  <div className="text-center py-20 text-muted-foreground">
                    {isRTL ? "في انتظار رسائل جديدة..." : "Waiting for new messages..."}
                  </div>
                )}
                {liveMessages.map((msg, i) => (
                  <div key={i} className="bg-background p-3 rounded-lg border shadow-sm animate-in fade-in slide-in-from-top-2">
                    <div className="flex justify-between items-center mb-2 border-b pb-1">
                      <div className="text-xs font-bold text-primary">
                        {msg.fromUserName} → {msg.toUserName}
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        {format(new Date(msg.createdAt), 'HH:mm:ss')}
                      </div>
                    </div>
                    <div className="text-sm">{msg.content}</div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
