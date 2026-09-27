import useModalBackNavigation from '../hooks/useModalBackNavigation';
import React, { useState, useEffect, useRef } from 'react';
import ReactCrop, { type Crop, type PixelCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import useVisualViewportModal from '../hooks/useVisualViewportModal';

interface CaptureModalProps {
    language?: 'ko' | 'en' | 'ja';
    isOpen: boolean;
    isCaptureLoading: boolean;
    capturePreviewUrl: string | null;
    captureFileName?: string;
    onCancel?: () => void;
    onClose?: () => void;
}
const captureTranslations = {"en": {"이미지 생성 중": "Creating image", "캡처 미리보기 및 편집": "Capture preview and editor", "이미지 생성 중...": "Creating image…", "잠시만 기다려 주세요.": "Please wait.", "자르기 미리보기": "Crop preview", "캡쳐 미리보기": "Capture preview", "✂️ 자르기": "✂️ Crop", "🖍️ 그리기": "🖍️ Draw", "↺ 원본 복구": "↺ Restore original", "적용": "Apply", "원하는 영역을 드래그하세요": "Drag to select an area", "사용자 지정 색상": "Custom color", "↶ 되돌리기": "↶ Undo", "취소": "Cancel", "다운로드": "Download", "닫기": "Close"}, "ja": {"이미지 생성 중": "画像を生成中", "캡처 미리보기 및 편집": "キャプチャのプレビューと編集", "이미지 생성 중...": "画像を生成中…", "잠시만 기다려 주세요.": "しばらくお待ちください。", "자르기 미리보기": "切り抜きプレビュー", "캡쳐 미리보기": "キャプチャプレビュー", "✂️ 자르기": "✂️ 切り抜き", "🖍️ 그리기": "🖍️ 描画", "↺ 원본 복구": "↺ 元に戻す", "적용": "適用", "원하는 영역을 드래그하세요": "範囲をドラッグしてください", "사용자 지정 색상": "カスタムカラー", "↶ 되돌리기": "↶ 取り消す", "취소": "キャンセル", "다운로드": "ダウンロード", "닫기": "閉じる"}} as const;
const getMimeType = (filename?: string) => {
    if (!filename) return 'image/png';
    const ext = filename.split('.').pop()?.toLowerCase();
    if (ext === 'webp') return 'image/webp';
    if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
    return 'image/png';
};

const autoCropCanvas = (canvas: HTMLCanvasElement): HTMLCanvasElement => {
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return canvas;

    const width = canvas.width;
    const height = canvas.height;
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;

    let minX = width, minY = height, maxX = -1, maxY = -1;

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const i = (y * width + x) * 4;
            const r = data[i]; const g = data[i + 1]; const b = data[i + 2]; const a = data[i + 3];
            
            // Treat as empty if transparent or almost white
            const isEmpty = (a < 10) || (r > 245 && g > 245 && b > 245);
            
            if (!isEmpty) {
                if (x < minX) minX = x;
                if (x > maxX) maxX = x;
                if (y < minY) minY = y;
                if (y > maxY) maxY = y;
            }
        }
    }

    if (minX > maxX || minY > maxY) {
        return canvas; // entirely empty
    }

    const padding = 0; // do not add any extra padding
    minX = Math.max(0, minX - padding);
    minY = Math.max(0, minY - padding);
    maxX = Math.min(width - 1, maxX + padding);
    maxY = Math.min(height - 1, maxY + padding);

    const newWidth = maxX - minX + 1;
    const newHeight = maxY - minY + 1;

    // if cropped area is practically the same as original, return original
    if (newWidth >= width - 10 && newHeight >= height - 10) {
        return canvas;
    }

    const croppedCanvas = document.createElement('canvas');
    croppedCanvas.width = newWidth;
    croppedCanvas.height = newHeight;
    const croppedCtx = croppedCanvas.getContext('2d');
    if (croppedCtx) {
        croppedCtx.drawImage(canvas, minX, minY, newWidth, newHeight, 0, 0, newWidth, newHeight);
    }
    return croppedCanvas;
};

const CaptureModal: React.FC<CaptureModalProps> = ({
    language = 'ko',
    isOpen,
    isCaptureLoading,
    capturePreviewUrl,
    captureFileName,
    onCancel,
    onClose,
}) => {
    const text = (key: string) => language === 'ko' ? key : (captureTranslations[language] as Record<string, string>)[key] || key;
    const [editMode, setEditMode] = useState<'none' | 'crop' | 'draw'>('none');
    const [editedImageUrl, setEditedImageUrl] = useState<string | null>(null);
    const [historyUrl, setHistoryUrl] = useState<string | null>(null);
    const [crop, setCrop] = useState<Crop>();
    const [completedCrop, setCompletedCrop] = useState<PixelCrop>();

    // Draw states
    const [isDrawing, setIsDrawing] = useState(false);
    const [penColor, setPenColor] = useState('#ff0000');
    const [penWidth, setPenWidth] = useState(3);
    const [drawHistory, setDrawHistory] = useState<ImageData[]>([]);

    const imgRef = useRef<HTMLImageElement>(null);
    const drawCanvasRef = useRef<HTMLCanvasElement>(null);
    useModalBackNavigation(() => { if (isCaptureLoading) onCancel?.(); else onClose?.(); }, isOpen && !!(isCaptureLoading ? onCancel : onClose));
    const { viewportStyle, antiZoomStyle } = useVisualViewportModal({
        enabled: isOpen,
        zIndex: 10000,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
    });

    // Sync drawing canvas size with image size
    useEffect(() => {
        if (editMode === 'draw' && imgRef.current && drawCanvasRef.current) {
            const img = imgRef.current;
            const canvas = drawCanvasRef.current;
            canvas.width = img.width;
            canvas.height = img.height;
            setDrawHistory([]);
        }
    }, [editMode, editedImageUrl]);

    useEffect(() => {
        if (isOpen && capturePreviewUrl && !isCaptureLoading) {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');
                if (ctx) {
                    ctx.drawImage(img, 0, 0);
                    const croppedCanvas = autoCropCanvas(canvas);
                    const mimeType = getMimeType(captureFileName);
                    const newUrl = croppedCanvas.toDataURL(mimeType, 1.0);
                    setEditedImageUrl(newUrl);
                    setHistoryUrl(newUrl);
                } else {
                    setEditedImageUrl(capturePreviewUrl);
                    setHistoryUrl(capturePreviewUrl);
                }
                setEditMode('none');
                setCrop(undefined);
                setCompletedCrop(undefined);
            };
            img.src = capturePreviewUrl;
        }
    }, [isOpen, capturePreviewUrl, isCaptureLoading, captureFileName]);

    if (!isOpen) return null;

    const displayUrl = editedImageUrl || capturePreviewUrl;

    const applyCrop = () => {
        if (!completedCrop || !imgRef.current) return;
        const img = imgRef.current;
        const canvas = document.createElement('canvas');
        const scaleX = img.naturalWidth / img.width;
        const scaleY = img.naturalHeight / img.height;
        canvas.width = completedCrop.width * scaleX;
        canvas.height = completedCrop.height * scaleY;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.drawImage(
            img,
            completedCrop.x * scaleX,
            completedCrop.y * scaleY,
            completedCrop.width * scaleX,
            completedCrop.height * scaleY,
            0,
            0,
            completedCrop.width * scaleX,
            completedCrop.height * scaleY
        );

        const mimeType = getMimeType(captureFileName);
        setEditedImageUrl(canvas.toDataURL(mimeType, 1.0));
        setEditMode('none');
        setCrop(undefined);
        setCompletedCrop(undefined);
    };

    const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
        const canvas = drawCanvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Save current canvas state to history before starting new stroke
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        setDrawHistory(prev => [...prev, imageData]);

        setIsDrawing(true);

        const rect = canvas.getBoundingClientRect();
        const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
        const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;

        ctx.beginPath();
        ctx.moveTo(clientX - rect.left, clientY - rect.top);
    };

    const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
        if (!isDrawing) return;
        const canvas = drawCanvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const rect = canvas.getBoundingClientRect();
        const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
        const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;

        ctx.lineTo(clientX - rect.left, clientY - rect.top);
        ctx.strokeStyle = penColor;
        ctx.lineWidth = penWidth;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.stroke();
    };

    const stopDrawing = () => {
        setIsDrawing(false);
    };

    const undoDrawing = () => {
        if (drawHistory.length === 0) return;
        const canvas = drawCanvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const previousState = drawHistory[drawHistory.length - 1];
        ctx.putImageData(previousState, 0, 0);

        setDrawHistory(prev => prev.slice(0, -1));
    };

    const applyDrawing = () => {
        if (!imgRef.current || !drawCanvasRef.current) return;
        const img = imgRef.current;
        const drawCanvas = drawCanvasRef.current;

        const mergeCanvas = document.createElement('canvas');
        mergeCanvas.width = img.naturalWidth;
        mergeCanvas.height = img.naturalHeight;
        const ctx = mergeCanvas.getContext('2d');
        if (!ctx) return;

        // Draw original image
        ctx.drawImage(img, 0, 0);
        // Draw annotations scaled to original size
        ctx.drawImage(drawCanvas, 0, 0, img.naturalWidth, img.naturalHeight);

        const mimeType = getMimeType(captureFileName);
        setEditedImageUrl(mergeCanvas.toDataURL(mimeType, 1.0));
        setEditMode('none');
    };

    return (
        <div style={viewportStyle}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label={text(isCaptureLoading ? '이미지 생성 중' : '캡처 미리보기 및 편집')}
            style={{
                ...antiZoomStyle,
                flexDirection: 'column',
                padding: '20px',
                boxSizing: 'border-box',
            }}
            onClick={() => {
                if (!isCaptureLoading && editMode === 'none' && onClose) onClose();
            }}
        >
            <div
                style={{
                    maxWidth: '90%',
                    maxHeight: '80%',
                    overflow: 'auto',
                    backgroundColor: 'white',
                    borderRadius: '8px',
                    padding: '10px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    minWidth: 'min(300px, 100%)'
                }}
                onClick={(e) => e.stopPropagation()}
            >
                {isCaptureLoading ? (
                    <div style={{ padding: '40px', textAlign: 'center', width: '100%' }}>
                        <h3 style={{ marginBottom: '20px', color: '#333' }}>{text("이미지 생성 중...")}</h3>
                        <div style={{
                            width: '100%',
                            height: '10px',
                            backgroundColor: '#f0f0f0',
                            borderRadius: '5px',
                            overflow: 'hidden',
                            marginBottom: '10px'
                        }}>
                            <div style={{
                                width: '100%',
                                height: '100%',
                                backgroundColor: '#4CAF50',
                                animation: 'loadingProgress 2s infinite ease-in-out',
                                transformOrigin: '0% 50%'
                            }} />
                        </div>
                        <style>{`
                            @keyframes loadingProgress {
                                0% { transform: scaleX(0); }
                                50% { transform: scaleX(1); }
                                100% { transform: scaleX(0); transform-origin: 100% 50%; }
                            }
                        `}</style>
                        <p style={{ color: '#666', fontSize: '14px' }}>{text("잠시만 기다려 주세요.")}</p>
                    </div>
                ) : (
                    <div style={{ position: 'relative', width: '100%', display: 'flex', justifyContent: 'center' }}>
                        {editMode === 'crop' && displayUrl ? (
                            <ReactCrop
                                crop={crop}
                                onChange={(_, percentCrop) => setCrop(percentCrop)}
                                onComplete={(c) => setCompletedCrop(c)}
                                style={{ maxWidth: '100%' }}
                            >
                                <img
                                    ref={imgRef}
                                    src={displayUrl}
                                    alt={text("자르기 미리보기")}
                                    style={{ maxWidth: '100%', height: 'auto', display: 'block' }}
                                />
                            </ReactCrop>
                        ) : (
                            <img
                                ref={imgRef}
                                src={displayUrl || ''}
                                alt={text("캡쳐 미리보기")}
                                style={{
                                    maxWidth: '100%',
                                    height: 'auto',
                                    display: 'block'
                                }}
                            />
                        )}

                        {editMode === 'draw' && displayUrl && (
                            <canvas
                                ref={drawCanvasRef}
                                onMouseDown={startDrawing}
                                onMouseMove={draw}
                                onMouseUp={stopDrawing}
                                onMouseLeave={stopDrawing}
                                onTouchStart={startDrawing}
                                onTouchMove={draw}
                                onTouchEnd={stopDrawing}
                                style={{
                                    position: 'absolute',
                                    top: 0,
                                    left: 0,
                                    cursor: 'crosshair',
                                    touchAction: 'none', // Prevent scrolling while drawing
                                    width: imgRef.current?.width || '100%',
                                    height: imgRef.current?.height || '100%',
                                }}
                            />
                        )}
                    </div>
                )}
            </div>

            {/* Editing Toolbar */}
            {!isCaptureLoading && displayUrl && (
                <div
                    style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center' }}
                    onClick={(e) => e.stopPropagation()}
                >
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center' }}>
                        <button
                            onClick={() => setEditMode(editMode === 'crop' ? 'none' : 'crop')}
                            style={{
                                padding: '8px 16px',
                                backgroundColor: editMode === 'crop' ? '#007bff' : '#f8f9fa',
                                color: editMode === 'crop' ? 'white' : '#333',
                                border: '1px solid #ced4da',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontSize: '0.9rem',
                                fontWeight: 'bold'
                            }}
                        >
                            {text("✂️ 자르기")}
                        </button>
                        <button
                            onClick={() => setEditMode(editMode === 'draw' ? 'none' : 'draw')}
                            style={{
                                padding: '8px 16px',
                                backgroundColor: editMode === 'draw' ? '#007bff' : '#f8f9fa',
                                color: editMode === 'draw' ? 'white' : '#333',
                                border: '1px solid #ced4da',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontSize: '0.9rem',
                                fontWeight: 'bold'
                            }}
                        >
                            {text("🖍️ 그리기")}
                        </button>
                        {historyUrl !== editedImageUrl && (
                            <button
                                onClick={() => setEditedImageUrl(historyUrl)}
                                style={{
                                    padding: '8px 16px',
                                    backgroundColor: '#fff3cd',
                                    color: '#856404',
                                    border: '1px solid #ffeeba',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    fontSize: '0.9rem'
                                }}
                            >
                                {text("↺ 원본 복구")}
                            </button>
                        )}
                    </div>

                    {/* Sub Toolbars */}
                    {editMode === 'crop' && (
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', backgroundColor: '#e9ecef', padding: '8px', borderRadius: '4px' }}>
                            <button
                                onClick={applyCrop}
                                disabled={!completedCrop?.width || !completedCrop?.height}
                                style={{
                                    padding: '6px 12px',
                                    backgroundColor: (!completedCrop?.width || !completedCrop?.height) ? '#ccc' : '#28a745',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '4px',
                                    cursor: (!completedCrop?.width || !completedCrop?.height) ? 'not-allowed' : 'pointer',
                                    fontWeight: 'bold'
                                }}
                            >
                                {text("적용")}
                            </button>
                            <span style={{ fontSize: '0.85rem', color: '#666' }}>{text("원하는 영역을 드래그하세요")}</span>
                        </div>
                    )}

                    {editMode === 'draw' && (
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', backgroundColor: '#e9ecef', padding: '8px', borderRadius: '4px', flexWrap: 'wrap' }}>
                            <div style={{ display: 'flex', gap: '4px', alignItems: 'center', marginRight: '8px' }}>
                                {['#ff0000', '#fd7e14', '#ffc107', '#28a745', '#007bff', '#6f42c1', '#000000', '#ffffff'].map(color => (
                                    <button
                                        key={color}
                                        onClick={() => setPenColor(color)}
                                        style={{
                                            width: '24px',
                                            height: '24px',
                                            borderRadius: '50%',
                                            backgroundColor: color,
                                            border: penColor === color ? '2px solid #555' : '1px solid #ccc',
                                            cursor: 'pointer',
                                            padding: 0,
                                            boxShadow: penColor === color ? '0 0 0 2px white inset' : 'none'
                                        }}
                                        title={color}
                                    />
                                ))}
                            </div>
                            <input
                                type="color"
                                value={penColor}
                                onChange={(e) => setPenColor(e.target.value)}
                                style={{ cursor: 'pointer', width: '30px', height: '30px', padding: '0', border: 'none' }}
                                title={text("사용자 지정 색상")}
                            />
                            <input
                                type="range"
                                min="1" max="20"
                                value={penWidth}
                                onChange={(e) => setPenWidth(parseInt(e.target.value))}
                                style={{ width: '80px' }}
                            />
                            <button
                                onClick={undoDrawing}
                                disabled={drawHistory.length === 0}
                                style={{
                                    padding: '6px 12px',
                                    backgroundColor: drawHistory.length === 0 ? '#ccc' : '#ffc107',
                                    color: '#333',
                                    border: 'none',
                                    borderRadius: '4px',
                                    cursor: drawHistory.length === 0 ? 'not-allowed' : 'pointer',
                                    fontWeight: 'bold',
                                    marginLeft: '8px'
                                }}
                            >
                                {text("↶ 되돌리기")}
                            </button>
                            <button
                                onClick={applyDrawing}
                                style={{
                                    padding: '6px 12px',
                                    backgroundColor: '#28a745',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    fontWeight: 'bold'
                                }}
                            >
                                {text("적용")}
                            </button>
                        </div>
                    )}
                </div>
            )}

            <div
                style={{ marginTop: '20px', display: 'flex', gap: '12px' }}
                onClick={(e) => e.stopPropagation()}
            >
                {isCaptureLoading ? (
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            if (onCancel) onCancel();
                        }}
                        style={{
                            padding: '12px 24px',
                            fontSize: '1.1rem',
                            fontWeight: 'bold',
                            backgroundColor: '#ff4444',
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
                            cursor: 'pointer'
                        }}
                    >
                        {text("취소")}
                    </button>
                ) : (
                    <>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                const link = document.createElement('a');
                                link.download = captureFileName || 'capture.png';
                                link.href = displayUrl || '';
                                link.click();
                            }}
                            style={{
                                padding: '12px 24px',
                                fontSize: '1.1rem',
                                fontWeight: 'bold',
                                backgroundColor: '#4CAF50',
                                color: 'white',
                                border: 'none',
                                borderRadius: '8px',
                                cursor: 'pointer'
                            }}
                        >
                            {text("다운로드")}
                        </button>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                if (onClose) onClose();
                            }}
                            style={{
                                padding: '12px 24px',
                                fontSize: '1.1rem',
                                fontWeight: 'bold',
                                backgroundColor: '#666',
                                color: 'white',
                                border: 'none',
                                borderRadius: '8px',
                                cursor: 'pointer'
                            }}
                        >
                            {text("닫기")}
                        </button>
                    </>
                )}
            </div>
          </div>
        </div>
    );
};

export default CaptureModal;
