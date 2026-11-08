import { useEffect, useRef, type PointerEvent } from 'react';
import { Eraser } from 'lucide-react';
import { Button } from '@/components/Button';

const PAD_WIDTH = 600;
const PAD_HEIGHT = 200;

interface SignaturePadProps {
  initialImage: string | null;
  onChange: (dataUrl: string | null) => void;
}

export function SignaturePad({ initialImage, onChange }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const initialRef = useRef(initialImage);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return;
    context.lineWidth = 2.5;
    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.strokeStyle = '#1c1917';

    const source = initialRef.current;
    if (!source) return;
    const image = new Image();
    image.onload = () => {
      const scale = Math.min(PAD_WIDTH / image.width, PAD_HEIGHT / image.height);
      const width = image.width * scale;
      const height = image.height * scale;
      context.drawImage(image, (PAD_WIDTH - width) / 2, (PAD_HEIGHT - height) / 2, width, height);
    };
    image.src = source;
  }, []);

  function pointFor(event: PointerEvent<HTMLCanvasElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) * PAD_WIDTH) / rect.width,
      y: ((event.clientY - rect.top) * PAD_HEIGHT) / rect.height,
    };
  }

  function handlePointerDown(event: PointerEvent<HTMLCanvasElement>) {
    const context = canvasRef.current?.getContext('2d');
    if (!context) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drawingRef.current = true;
    const { x, y } = pointFor(event);
    context.beginPath();
    context.moveTo(x, y);
  }

  function handlePointerMove(event: PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return;
    const context = canvasRef.current?.getContext('2d');
    if (!context) return;
    const { x, y } = pointFor(event);
    context.lineTo(x, y);
    context.stroke();
  }

  function finishStroke() {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    const canvas = canvasRef.current;
    if (!canvas) return;
    onChange(canvas.toDataURL('image/png'));
  }

  function handleClear() {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return;
    context.clearRect(0, 0, PAD_WIDTH, PAD_HEIGHT);
    onChange(null);
  }

  return (
    <div className="space-y-2">
      <canvas
        ref={canvasRef}
        width={PAD_WIDTH}
        height={PAD_HEIGHT}
        aria-label="Signature drawing area"
        className="block aspect-[3/1] w-full cursor-crosshair touch-none rounded-xl border border-dashed border-stone-300 bg-white"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishStroke}
        onPointerLeave={finishStroke}
      />
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-stone-500">Sign with your mouse or finger inside the box.</p>
        <Button variant="ghost" onClick={handleClear} className="px-2 py-1 text-xs">
          <Eraser className="h-3.5 w-3.5" aria-hidden /> Clear pad
        </Button>
      </div>
    </div>
  );
}
