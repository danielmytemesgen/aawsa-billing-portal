import { NextResponse } from 'next/server';
import { notificationEmitter } from '@/lib/notification-emitter';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
  let controller: ReadableStreamDefaultController;

  const stream = new ReadableStream({
    start(c) {
      controller = c;
      
      const onNotification = (data: any) => {
        try {
          const formattedData = `data: ${JSON.stringify(data)}\n\n`;
          controller.enqueue(new TextEncoder().encode(formattedData));
        } catch (err) {
          console.error("Failed to enqueue notification:", err);
        }
      };

      notificationEmitter.on('new_notification', onNotification);

      // Keep connection alive with heartbeat comments every 30s
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(new TextEncoder().encode(': heartbeat\n\n'));
        } catch (err) {
          clearInterval(heartbeat);
        }
      }, 30000);

      request.signal.addEventListener('abort', () => {
        notificationEmitter.off('new_notification', onNotification);
        clearInterval(heartbeat);
        try { controller.close(); } catch {}
      });
    }
  });

  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable buffering for Nginx
    },
  });
}
