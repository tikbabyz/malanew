import React from "react";
import { useNavigate } from "react-router-dom";
import API from '../../services/api.js';
import styles from "./Detect.module.css";

const LABEL_ALIASES = {
  แดง: "red", สีแดง: "red", red: "red",
  เขียว: "green", green: "green",
  น้ำเงิน: "blue", ฟ้า: "blue", blue: "blue",
  ชมพู: "pink", pink: "pink",
  ม่วง: "purple", purple: "purple",
};

const norm = (s) =>
  LABEL_ALIASES[s?.toString()?.trim()?.toLowerCase()] ??
  s?.toString()?.trim()?.toLowerCase();

const COLOR_LABEL = {
  red: "ไม้แดง", 
  green: "ไม้เขียว", 
  blue: "ไม้น้ำเงิน",
  pink: "ไม้ชมพู", 
  purple: "ไม้ม่วง",
};

export default function Detect() {
  const nav = useNavigate();
  
  // State สำหรับภาพและการตรวจจับ
  const imgRef = React.useRef(null);
  const [file, setFile] = React.useState(null);
  const [preview, setPreview] = React.useState("");
  const [bbox, setBbox] = React.useState(null);
  const [drag, setDrag] = React.useState(null);
  const [result, setResult] = React.useState(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  
  // State สำหรับกล้อง
  const videoRef = React.useRef(null);
  const canvasRef = React.useRef(null);
  const [cameraStream, setCameraStream] = React.useState(null);
  const [showCamera, setShowCamera] = React.useState(false);
  const [cameraError, setCameraError] = React.useState("");
  const [facingMode, setFacingMode] = React.useState('environment'); // 'user' for front, 'environment' for back

  // ฟังก์ชันเปิดกล้อง
  const startCamera = async (facing = facingMode) => {
    console.log('📷 Starting camera with facing mode:', facing);
    setCameraError("");
    
    try {
      // หยุดกล้องเดิมก่อน (ถ้ามี)
      if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
      }
      
      const constraints = {
        video: { 
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          facingMode: facing
        }
      };
      
      console.log('📷 Camera constraints:', constraints);
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      
      console.log('✅ Camera stream obtained');
      setCameraStream(stream);
      setShowCamera(true);
      setFacingMode(facing);
      
      // ตั้งค่า video element
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (err) {
      console.error('❌ Camera access failed:', err);
      setCameraError(`ไม่สามารถเข้าถึงกล้องได้: ${err.message}`);
      
      // ถ้าไม่สามารถใช้กล้องได้ ให้แสดง fallback options
      if (err.name === 'NotAllowedError') {
        setCameraError('กรุณาอนุญาตให้เว็บไซต์เข้าถึงกล้อง');
      } else if (err.name === 'NotFoundError') {
        setCameraError('ไม่พบกล้องในอุปกรณ์นี้');
      }
    }
  };

  // ฟังก์ชันสลับกล้อง
  const switchCamera = () => {
    const newFacing = facingMode === 'environment' ? 'user' : 'environment';
    console.log('🔄 Switching camera from', facingMode, 'to', newFacing);
    startCamera(newFacing);
  };

  // ฟังก์ชันปิดกล้อง
  const stopCamera = () => {
    console.log('📷 Stopping camera...');
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
    setShowCamera(false);
    setCameraError("");
  };

  // ฟังก์ชันถ่ายรูป
  const capturePhoto = () => {
    console.log('📸 Capturing photo...');
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    if (!video || !canvas) {
      console.error('❌ Video or canvas not available');
      return;
    }
    
    // ตั้งค่าขนาด canvas ตามขนาดวิดีโอ
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    // วาดภาพจากวิดีโอลงใน canvas
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    // แปลงเป็น blob แล้วสร้างไฟล์
    canvas.toBlob((blob) => {
      if (blob) {
        const capturedFile = new File([blob], `camera-capture-${Date.now()}.jpg`, {
          type: 'image/jpeg'
        });
        
        console.log('✅ Photo captured:', capturedFile);
        
        // ตั้งค่าไฟล์และ preview
        setFile(capturedFile);
        setPreview(URL.createObjectURL(capturedFile));
        setBbox(null);
        setDrag(null);
        setResult(null);
        setError("");
        
        // ปิดกล้อง
        stopCamera();
      }
    }, 'image/jpeg', 0.9);
  };

  // State สำหรับราคาสี (ควรมาจาก API หรือ store)
  const [colorPrices, setColorPrices] = React.useState({
    red: 5,
    green: 9,
    blue: 12,
    pink: 18,
    purple: 22
  });

  // Cleanup camera stream เมื่อ component unmount
  React.useEffect(() => {
    return () => {
      if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [cameraStream]);

  // Keyboard shortcuts สำหรับกล้อง
  React.useEffect(() => {
    const handleKeyPress = (e) => {
      if (!showCamera) return;
      
      if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault();
        capturePhoto();
      } else if (e.code === 'Escape') {
        e.preventDefault();
        stopCamera();
      } else if (e.code === 'Tab') {
        e.preventDefault();
        switchCamera();
      }
    };

    if (showCamera) {
      window.addEventListener('keydown', handleKeyPress);
      return () => window.removeEventListener('keydown', handleKeyPress);
    }
  }, [showCamera, capturePhoto, stopCamera, switchCamera]);

  // โหลดราคาสีจาก API
  React.useEffect(() => {
    const loadColorPrices = async () => {
      try {
        const prices = await API.colorPrices.get();
        setColorPrices(prices);
      } catch (err) {
        console.warn('Could not load color prices:', err);
        // ใช้ราคาเริ่มต้น
      }
    };
    loadColorPrices();
  }, []);

  // ฟังก์ชันสำหรับการอัปโหลดไฟล์
  const onFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!["image/jpeg", "image/png", "image/heic", "image/heif"].includes(f.type)) {
      setError("รองรับเฉพาะ JPEG, PNG, HEIC หรือ HEIF");
      return;
    }
    setError("");
    setFile(f);
    setPreview(URL.createObjectURL(f));
    setBbox(null);
    setDrag(null);
    setResult(null);
  };

  const onMouseDown = (e) => {
    if (!imgRef.current) return;
    const r = imgRef.current.getBoundingClientRect();
    setDrag({ x1: e.clientX - r.left, y1: e.clientY - r.top, x2: e.clientX - r.left, y2: e.clientY - r.top });
  };
  const onMouseMove = (e) => {
    if (!drag || !imgRef.current) return;
    const r = imgRef.current.getBoundingClientRect();
    setDrag((d) => ({ ...d, x2: e.clientX - r.left, y2: e.clientY - r.top }));
  };
  const onMouseUp = () => {
    if (!drag || !imgRef.current) return;
    const el = imgRef.current;
    const rect = el.getBoundingClientRect();
    const sx = el.naturalWidth / rect.width;
    const sy = el.naturalHeight / rect.height;
    const x1 = Math.max(0, Math.min(drag.x1, drag.x2)) * sx;
    const y1 = Math.max(0, Math.min(drag.y1, drag.y2)) * sy;
    const x2 = Math.min(rect.width, Math.max(drag.x1, drag.x2)) * sx;
    const y2 = Math.min(rect.height, Math.max(drag.y1, drag.y2)) * sy;
    setBbox({ x1: Math.round(x1), y1: Math.round(y1), x2: Math.round(x2), y2: Math.round(y2) });
    setDrag(null);
  };

  // touch = mouse
  const getTouchPoint = (e) => {
    const t = e.touches[0] || e.changedTouches[0];
    const r = imgRef.current.getBoundingClientRect();
    return { x: t.clientX - r.left, y: t.clientY - r.top };
  };
  const onTouchStart = (e) => { if (!imgRef.current) return; const p = getTouchPoint(e); setDrag({ x1: p.x, y1: p.y, x2: p.x, y2: p.y }); };
  const onTouchMove  = (e) => { if (!drag || !imgRef.current) return; const p = getTouchPoint(e); setDrag((d) => ({ ...d, x2: p.x, y2: p.y })); };
  const onTouchEnd   = () => onMouseUp();

  const clearBox = () => setBbox(null);

  // ฟังก์ชันสำหรับการตรวจจับด้วย AI
  async function runDetect() {
    if (!file) {
      setError("กรุณาเลือกไฟล์ภาพก่อน");
      return;
    }
    
    console.log('🔍 Starting AI detection...');
    console.log('File:', file.name, 'Size:', file.size, 'Type:', file.type);
    console.log('Bbox:', bbox);
    
    setLoading(true);
    setError("");
    setResult(null);
    
    try {
      const res = await API.detectImage(file, bbox);
      console.log('✅ Detection result:', res);
      setResult(res);
    } catch (err) {
      console.error('❌ Detection failed:', err);
      setError(String(err.message || err));
    } finally {
      setLoading(false);
    }
  }

  // ฟังก์ชันสำหรับสร้างบิลจากผลการตรวจจับ
  const createBill = () => {
    if (!result) {
      alert("ไม่มีผลการตรวจจับ กรุณาตรวจจับภาพก่อน");
      return;
    }
    
    console.log('📝 Creating bill from detection result:', result);
    console.log('Available color prices:', colorPrices);
    
    const items = [];
    const missing = [];
    
    for (const [raw, qty] of Object.entries(result.counts || {})) {
      const c = norm(raw);
      const n = Number(qty || 0);
      
      console.log(`Processing ${raw} -> ${c}, qty: ${n}`);
      
      if (!n) continue;
      
      const price = Number(colorPrices?.[c]);
      if (Number.isNaN(price) || price <= 0) { 
        missing.push(c); 
        continue; 
      }
      
      items.push({ 
        id: `color-${c}`, 
        name: COLOR_LABEL[c] || c, 
        color: c, 
        price, 
        qty: n 
      });
    }
    
    console.log('Created items:', items);
    console.log('Missing prices for:', missing);
    
    if (!items.length) { 
      alert("ไม่พบรายการที่มีราคา (โปรดตั้งราคาให้สีที่ต้องการก่อน)"); 
      return; 
    }
    
    if (missing.length) { 
      alert(`ยังไม่ได้ตั้งราคาให้สี: ${missing.join(", ")}`); 
    }
    
    nav("/staff/pos", { state: { pendingItems: items } });
  };

  // ฟังก์ชันกลับไปหน้า POS
  const backToPOS = () => {
    console.log('🔙 Going back to POS...');
    sessionStorage.setItem("detectLast", JSON.stringify({ preview, bbox, result }));
    nav("/staff/pos");
  };

  return (
    <div className={`container ${styles.detect}`}>
      {/* Panel: อัปโหลด + พื้นที่ลากกรอบ */}
      <div className={styles.panel}>
        <div className={styles.headerBar}>
          <h2 className={styles.title}>ตรวจจับไม้หม่าล่า (AI)</h2>
          <button className="btn ghost" onClick={backToPOS}>กลับตะกร้า</button>
        </div>

        <div className={styles.fileField}>
          <input
            className={styles.fileInput}
            type="file"
            accept="image/jpeg,image/png,image/heic,image/heif"
            capture="environment"
            onChange={onFile}
          />
          
          {/* ปุ่มเปิดกล้องสำหรับคอมพิวเตอร์ */}
          <button
            type="button"
            className={styles.webcamBtn}
            onClick={startCamera}
          >
            📷 ถ่ายภาพด้วยกล้องคอม
          </button>
          
          {cameraError && (
            <div className={styles.errorBox}>
              <div>{cameraError}</div>
              <button
                onClick={() => {
                  console.log('📁 Opening file picker as fallback...');
                  const input = document.createElement("input");
                  input.type = "file";
                  input.accept = "image/jpeg,image/png,image/heic,image/heif";
                  input.onchange = (e) => {
                    console.log('📁 Fallback file selected:', e.target.files[0]);
                    onFile(e);
                    setCameraError("");
                  };
                  input.click();
                }}
                className={styles.fallbackBtn}
              >
                📁 เลือกไฟล์แทน
              </button>
            </div>
          )}
        </div>

        {/* Camera Modal */}
        {showCamera && (
          <div className={styles.cameraModal}>
            <div className={styles.cameraContainer}>
              <h3 style={{ margin: '0 0 16px 0', color: 'var(--text)' }}>📷 ถ่ายภาพ</h3>
              
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={styles.cameraVideo}
              />
              
              <div className={styles.cameraControls}>
                <button
                  onClick={capturePhoto}
                  className={`${styles.cameraBtn} ${styles.capture}`}
                >
                  📸 ถ่ายรูป
                </button>
                
                <button
                  onClick={switchCamera}
                  className={`${styles.cameraBtn} ${styles.switch}`}
                >
                  🔄 สลับกล้อง
                </button>
                
                <button
                  onClick={stopCamera}
                  className={`${styles.cameraBtn} ${styles.cancel}`}
                >
                  ❌ ยกเลิก
                </button>
              </div>
              
              <div className={styles.cameraStatus}>
                <div>กล้อง: {facingMode === 'environment' ? '📱 หลัง' : '🤳 หน้า'}</div>
                <div className={styles.cameraInstructions}>
                  Space/Enter: ถ่ายรูป | Tab: สลับกล้อง | Esc: ยกเลิก
                </div>
              </div>
            </div>
            
            {/* Hidden canvas for photo capture */}
            <canvas ref={canvasRef} style={{ display: 'none' }} />
          </div>
        )}

        {preview && (
          <>
            <div
              className={styles.cropWrap}
              onMouseDown={onMouseDown}
              onMouseMove={onMouseMove}
              onMouseUp={onMouseUp}
              onTouchStart={onTouchStart}
              onTouchMove={onTouchMove}
              onTouchEnd={onTouchEnd}
            >
              <img ref={imgRef} src={preview} alt="preview" draggable={false} className={styles.previewImg} />
              {drag && (
                <div
                  className={styles.dragBox}
                  style={{
                    left: Math.min(drag.x1, drag.x2),
                    top: Math.min(drag.y1, drag.y2),
                    width: Math.abs(drag.x2 - drag.x1),
                    height: Math.abs(drag.y2 - drag.y1),
                  }}
                />
              )}
              {bbox && imgRef.current && (() => {
                const el = imgRef.current;
                const rect = el.getBoundingClientRect();
                const sx = rect.width / el.naturalWidth;
                const sy = rect.height / el.naturalHeight;
                const left = bbox.x1 * sx;
                const top = bbox.y1 * sy;
                const width = (bbox.x2 - bbox.x1) * sx;
                const height = (bbox.y2 - bbox.y1) * sy;
                return <div className={styles.bboxBox} style={{ left, top, width, height }} />;
              })()}
            </div>

            <div className={styles.actionRow}>
              <button className="btn" onClick={runDetect} disabled={!file || loading}>
                {loading ? "กำลังตรวจจับ..." : "เริ่มตรวจจับ (AI)"}
              </button>
              <button className="btn ghost" onClick={clearBox}>ลบกรอบ</button>
            </div>
          </>
        )}

        {!!error && <div style={{ color: "#fca5a5", marginTop: 8 }}>{error}</div>}
        <p className={styles.tip}>แนะนำ: ลากกรอบเฉพาะ “กองไม้” เพื่อลดการจับฉากหลัง</p>
      </div>

      {/* Panel: ผลลัพธ์ */}
      <div className={styles.panel}>
        <h3 className={styles.title} style={{ margin: 0 }}>ผลลัพธ์</h3>

        {!result && <div className="muted">อัปโหลดแล้วกดตรวจจับเพื่อดูผล</div>}

        {result && (
          <>
            {result.annotated && (
              <img
                src={`data:image/png;base64,${result.annotated}`}
                alt="annotated"
                className={styles.resultImg}
              />
            )}

            <div className={styles.summary}>
              <strong>สรุปจำนวน (สี → ราคา/ไม้):</strong>
              <div className={styles.pillRow}>
                {Object.entries(result.counts || {}).map(([k, v]) => {
                  const c = norm(k);
                  const label = COLOR_LABEL[c] || c;
                  const price = colorPrices?.[c];
                  return (
                    <span key={k} className={styles.countPill}>
                      {label} • {price ?? "—"}฿ x
                      <input
                        type="number"
                        min={0}
                        value={v}
                        className={styles.countInput}
                        onChange={(e) => {
                          const newVal = Math.max(0, parseInt(e.target.value || "0", 10));
                          setResult((r) => {
                            const newCounts = { ...(r?.counts || {}) };
                            newCounts[k] = newVal;
                            return { ...r, counts: newCounts };
                          });
                        }}
                      />
                    </span>
                  );
                })}
              </div>
            </div>

            <button className="btn" style={{ marginTop: 12 }} onClick={createBill}>
              เพิ่มเข้าตะกร้า & ไปคิดเงิน
            </button>
          </>
        )}
      </div>
    </div>
  );
}
