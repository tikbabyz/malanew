// src/pages/staff/WorkflowPOS.jsx
import React, { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { 
  FaUtensils, 
  FaCamera, 
  FaCreditCard, 
  FaShoppingCart, 
  FaSearch, 
  FaPlus, 
  FaMinus, 
  FaTrash,
  FaArrowLeft,
  FaArrowRight,
  FaCheck,
  FaSpinner,
  FaExclamationTriangle,
  FaEye,
  FaMoneyBillWave,
  FaQrcode,
  FaBullseye,
  FaRobot
} from 'react-icons/fa';
import ProductPicker from "@features/staff/components/ProductPicker/ProductPicker.jsx";
import { calcTotals, splitEqual } from "@utils/billing.js";
import { effectiveUnitPrice, baseUnitPrice } from "@utils/price.js";
import styles from "./WorkflowPOS.module.css";
import { useAuthStore } from "@store/auth.js";
import { useDataStore } from "@store/data.js";
import API from '@services/api';
import { API_PREFIX } from "@services/api";

// Constants
const STORE_PROFILE = {
  name: "ร้านหม่าล่า",
  address: "123 ตำบลในเมือง อำเภอเมือง นครราชสีมา 30000",
  phone: "0923799043",
  taxId: "0123456789012"
  
};

const LABEL_ALIASES = {
  แดง: "red", สีแดง: "red", red: "red",
  เขียว: "green", green: "green",
  น้ำเงิน: "blue", ฟ้า: "blue", blue: "blue",
  ชมพู: "pink", pink: "pink",
  ม่วง: "purple", purple: "purple",
};

const COLOR_LABEL = {
  red: "ไม้แดง", 
  green: "ไม้เขียว", 
  blue: "ไม้น้ำเงิน",
  pink: "ไม้ชมพู", 
  purple: "ไม้ม่วง",
};

const WORKFLOW_STEPS = [
  { id: 'pos', title: 'เลือกสินค้า', icon: FaShoppingCart },
  { id: 'detect', title: 'ตรวจจับ AI', icon: FaRobot },
  { id: 'billing', title: 'ชำระเงิน', icon: FaCreditCard }
];

const MAX_DETECT_UPLOAD_BYTES = 1.5 * 1024 * 1024; // 1.5MB
const MAX_DETECT_DIMENSION = 1600;
const MIN_DETECT_DIMENSION = 640;

// Helper functions
const norm = (s) =>
  LABEL_ALIASES[s?.toString()?.trim()?.toLowerCase()] ??
  s?.toString()?.trim()?.toLowerCase();

function safeReadArray(key, fallback = []) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : fallback;
  } catch {
    return fallback;
  }
}

export default function WorkflowPOS() {
  const nav = useNavigate();
  const location = useLocation();
  const { user } = useAuthStore?.() || {};
  const { 
    products, 
    colorPrices, 
    settings, 
    updateProduct, 
    loadProducts, 
    loadColorPrices 
  } = useDataStore();
  const beverageProducts = useMemo(() => {
    const keywordTh = "เครื่องดื่ม";
    const keywordEn = "drink";
    return (products || []).filter((product) => {
      const category = (product?.category || "").toLowerCase();
      return category.includes(keywordTh) || category.includes(keywordEn);
    });
  }, [products]);
  const currentUserName = user?.displayName || user?.name || user?.username || "พนักงาน";

  const colorOptions = useMemo(() => {
    if (!colorPrices) return [];

    return Object.entries(colorPrices)
      .map(([rawKey, entry]) => {
        const normalized = norm(rawKey);
        const label = COLOR_LABEL[normalized] || rawKey;
        const price = Number(entry?.price ?? 0);
        const stock = entry?.stock;
        return {
          key: rawKey,
          normalized,
          label,
          price,
          stock: typeof stock === "number" ? stock : null,
        };
      })
      .filter((option) => option.price > 0)
      .sort((a, b) => a.label.localeCompare(b.label, "th"));
  }, [colorPrices]);

  // Loading state
  const [isLoadingData, setIsLoadingData] = useState(true);

  // Main workflow state
  const [currentStep, setCurrentStep] = useState('pos');
  const [workflowData, setWorkflowData] = useState({
    items: [],
    order: null,
    detectionResult: null
  });

  // POS State
  const [items, setItems] = useState(() => safeReadArray("posCart", []));

  // Detect State
  const imgRef = useRef(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [compressing, setCompressing] = useState(false);
  const [error, setError] = useState("");
  const [cameraStream, setCameraStream] = useState(null);
  const [showCamera, setShowCamera] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [facingMode, setFacingMode] = useState('environment');

  useEffect(() => {
    return () => {
      if (preview) {
        URL.revokeObjectURL(preview);
      }
    };
  }, [preview]);

  const updatePreview = (nextFile) => {
    setPreview((prevUrl) => {
      if (prevUrl) {
        URL.revokeObjectURL(prevUrl);
      }
      if (!nextFile) {
        return "";
      }
      return URL.createObjectURL(nextFile);
    });
  };

  const ensureCanvas = () => {
    let canvas = canvasRef.current;
    if (!(canvas instanceof HTMLCanvasElement)) {
      canvas = document.createElement('canvas');
      canvasRef.current = canvas;
    }
    return canvas;
  };

  const readFileAsDataURL = (inputFile) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('ไม่สามารถอ่านไฟล์ภาพได้'));
      reader.readAsDataURL(inputFile);
    });

  const loadImage = (src) =>
    new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('ไม่สามารถโหลดรูปภาพได้'));
      img.src = typeof src === 'string' ? src : '';
    });

  const renderImageToBlob = async (image, width, height, quality) => {
    const canvas = ensureCanvas();
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('อุปกรณ์นี้ไม่รองรับการบีบอัดรูปภาพ');
    }
    canvas.width = width;
    canvas.height = height;
    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(image, 0, 0, width, height);
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error('ไม่สามารถสร้างรูปภาพหลังบีบอัดได้'));
          return;
        }
        resolve(blob);
      }, 'image/jpeg', quality);
    });
  };

  const preprocessImageFile = async (inputFile) => {
    if (!(inputFile instanceof File)) {
      throw new Error('ไฟล์ไม่ถูกต้อง');
    }

    const needsCompression = inputFile.size > MAX_DETECT_UPLOAD_BYTES;
    if (!needsCompression) {
      return inputFile;
    }

    const dataUrl = await readFileAsDataURL(inputFile);
    if (typeof dataUrl !== 'string') {
      return inputFile;
    }

    const image = await loadImage(dataUrl);
    let width = image.naturalWidth || image.width;
    let height = image.naturalHeight || image.height;

    if (!width || !height) {
      throw new Error('ไม่สามารถอ่านขนาดรูปภาพได้');
    }

    const maxDimension = Math.max(width, height);
    if (maxDimension > MAX_DETECT_DIMENSION) {
      const scale = MAX_DETECT_DIMENSION / maxDimension;
      width = Math.max(MIN_DETECT_DIMENSION, Math.round(width * scale));
      height = Math.max(MIN_DETECT_DIMENSION, Math.round(height * scale));
    }

    let currentWidth = width;
    let currentHeight = height;
    let quality = 0.85;
    let blob = await renderImageToBlob(image, currentWidth, currentHeight, quality);

    while (blob.size > MAX_DETECT_UPLOAD_BYTES && (quality > 0.55 || Math.max(currentWidth, currentHeight) > MIN_DETECT_DIMENSION)) {
      if (quality > 0.55) {
        quality = Math.max(0.55, quality - 0.1);
      } else {
        currentWidth = Math.max(MIN_DETECT_DIMENSION, Math.round(currentWidth * 0.85));
        currentHeight = Math.max(MIN_DETECT_DIMENSION, Math.round(currentHeight * 0.85));
      }
      blob = await renderImageToBlob(image, currentWidth, currentHeight, quality);
    }

    if (blob.size > MAX_DETECT_UPLOAD_BYTES) {
      throw new Error('ไม่สามารถลดขนาดรูปภาพให้ต่ำกว่า 1.5MB ได้ กรุณาถ่ายใหม่หรือเลือกไฟล์ที่เล็กลง');
    }

    console.log('เตรียมรูปภาพสำหรับ detect:', {
      originalSize: inputFile.size,
      processedSize: blob.size,
      width: currentWidth,
      height: currentHeight,
      quality,
    });

    const baseName = inputFile.name?.replace(/\.[^/.]+$/, '') || 'detect-upload';
    return new File([blob], `${baseName}.jpg`, {
      type: 'image/jpeg',
      lastModified: Date.now(),
    });
  };

  // Billing State
  const [order, setOrder] = useState(null);
  const [billingLoading, setBillingLoading] = useState(false);
  const [billingError, setBillingError] = useState("");
  const [splitMode, setSplitMode] = useState("NONE");
  const [splitPersons, setSplitPersons] = useState(1);
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [receivedAmount, setReceivedAmount] = useState(0);
  const [saving, setSaving] = useState(false);
  const [transferSlips, setTransferSlips] = useState([]);
  const [uploadingSlip, setUploadingSlip] = useState(false);
  const [paidPersons, setPaidPersons] = useState([]); // เก็บสถานะการจ่ายเงินของแต่ละคน
  const [discount, setDiscount] = useState(0); // ส่วนลดเป็นเปอร์เซ็นต์
  const [qrImage, setQrImage] = useState("");
  const [qrLabel, setQrLabel] = useState("");

  // Auth check
  useEffect(() => {
    if (!user) {
      nav("/login", { replace: true });
      return;
    }
    if (user.role !== "STAFF" && user.role !== "ADMIN") {
      nav("/", { replace: true });
      return;
    }
  }, [user, nav]);

  // Load initial data
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        setIsLoadingData(true);
        console.log('📦 Loading initial data for WorkflowPOS...');
        
        // โหลดข้อมูลสินค้าและราคาสี
        await Promise.all([
          loadProducts?.(),
          loadColorPrices?.()
        ]);
        
        console.log('✅ Initial data loaded successfully');
      } catch (error) {
        console.error('❌ Failed to load initial data:', error);
      } finally {
        setIsLoadingData(false);
      }
    };

    if (user && (user.role === "STAFF" || user.role === "ADMIN")) {
      loadInitialData();
    }
  }, [user, loadProducts, loadColorPrices]);

  // Save cart to localStorage
  useEffect(() => {
    localStorage.setItem("posCart", JSON.stringify(items));
  }, [items]);

  // Handle incoming items from other pages
  const mergedOnce = useRef(false);
  useEffect(() => {
    const incoming = location.state?.pendingItems;
    if (!incoming?.length || mergedOnce.current) return;
    setItems(incoming);
    mergedOnce.current = true;
    nav(".", { replace: true, state: null });
  }, [location.state, nav]);

  // Calculate totals
  const totals = useMemo(() => {
    return calcTotals(items);
  }, [items]);

  // Cleanup camera on unmount
  useEffect(() => {
    return () => {
      if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [cameraStream]);

  // POS Functions
  const addProduct = (p) => {
    if (!p) return;
    
    // ตรวจสอบ stock ก่อนเพิ่มสินค้า
    if ((p.stock || 0) <= 0) {
      console.log(`สินค้า "${p.name}" หมดสต็อกแล้ว ไม่สามารถเพิ่มได้`);
      return;
    }
    
    const base = baseUnitPrice(p, colorPrices);
    const unit = effectiveUnitPrice(p, colorPrices);

    setItems((prev) => {
      const i = prev.findIndex((x) => String(x.id) === String(p.id));
      if (i > -1) {
        const existingItem = prev[i];
        const newQty = Number(existingItem.qty || 0) + 1;
        
        // ตรวจสอบว่าจำนวนใหม่ไม่เกิน stock
        if (newQty > (p.stock || 0)) {
          console.log(`สินค้า "${p.name}" มีสต็อกเหลือเพียง ${p.stock} ชิ้น`);
          return prev;
        }
        
        const cp = [...prev];
        cp[i] = { ...cp[i], qty: newQty };
        return cp;
      }
      
      // เพิ่มสินค้าใหม่
      return [
        ...prev,
        {
          id: p.id,
          name: p.name,
          price: unit,
          basePrice: base,
          qty: 1,
          stock: p.stock, // เก็บ stock ไว้เพื่อใช้ตรวจสอบ
        },
      ];
    });
  };

  const changeQty = (id, delta) => {
    setItems((prev) =>
      prev.map((x) => {
        if (String(x.id) !== String(id)) return x;
        
        const newQty = Math.max(1, Number(x.qty || 1) + delta);
        
        // ถ้าเป็นการเพิ่มจำนวน ให้ตรวจสอบ stock
        if (delta > 0) {
          const product = products.find(p => String(p.id) === String(id));
          const availableStock = product?.stock || x.stock || 0;
          
          if (newQty > availableStock) {
            alert(`สินค้า "${x.name}" มีสต็อกเหลือเพียง ${availableStock} ชิ้น`);
            return x; // ไม่เปลี่ยนแปลงจำนวน
          }
        }
        
        return { ...x, qty: newQty };
      })
    );
  };

  const removeItem = (id) => {
    setItems((prev) => prev.filter((x) => String(x.id) !== String(id)));
  };

  const addColorItem = (colorKey) => {
    if (!colorKey) return;

    const normalized = norm(colorKey);
    const colorEntry =
      colorPrices?.[normalized] ??
      colorPrices?.[colorKey] ??
      colorPrices?.[String(colorKey).toLowerCase()];

    if (!colorEntry) {
      alert("ไม่พบข้อมูลราคาของสีนี้");
      return;
    }

    const price = Number(colorEntry?.price ?? 0);
    if (!price || Number.isNaN(price)) {
      alert("ยังไม่ได้ตั้งราคาสำหรับสีนี้");
      return;
    }

    const stock = typeof colorEntry?.stock === "number" ? colorEntry.stock : null;
    const itemId = `color-${normalized}`;

    setItems((prev) => {
      const existingIndex = prev.findIndex((item) => String(item.id) === itemId);
      if (existingIndex > -1) {
        const nextQty = Number(prev[existingIndex].qty || 0) + 1;
        if (stock != null && nextQty > stock) {
          alert(`สีนี้คงเหลือ ${stock} ไม้`);
          return prev;
        }
        const updated = [...prev];
        updated[existingIndex] = {
          ...updated[existingIndex],
          qty: nextQty,
        };
        return updated;
      }

      return [
        ...prev,
        {
          id: itemId,
          name: COLOR_LABEL[normalized] || normalized,
          color: normalized,
          price,
          qty: 1,
          stock: stock ?? undefined,
        },
      ];
    });
  };

  // Camera Functions
  const startCamera = async (facing = facingMode) => {
    setCameraError("");
    
    try {
      if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
      }
      
      // Check if we're on mobile
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      
      const constraints = {
        video: { 
          width: { ideal: isMobile ? 1280 : 1920 },
          height: { ideal: isMobile ? 720 : 1080 },
          facingMode: facing
        }
      };
      
      // For mobile, try to use specific camera constraints
      if (isMobile && facing === 'environment') {
        constraints.video = {
          ...constraints.video,
          facingMode: { exact: 'environment' }
        };
      }
      
      try {
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        setCameraStream(stream);
        setShowCamera(true);
        setFacingMode(facing);
        
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          // Add event listener to handle video load
          videoRef.current.onloadedmetadata = () => {
            videoRef.current.play().catch(err => {
              console.error('Error playing video:', err);
              setCameraError('ไม่สามารถเริ่มต้นกล้องได้ กรุณาลองใหม่');
            });
          };
        }
      } catch (specificErr) {
        // Fallback for mobile if exact constraint fails
        if (isMobile && facing === 'environment') {
          console.warn('Exact environment camera failed, trying general constraint');
          const fallbackConstraints = {
            video: { 
              width: { ideal: 1280 },
              height: { ideal: 720 },
              facingMode: 'environment'
            }
          };
          
          const stream = await navigator.mediaDevices.getUserMedia(fallbackConstraints);
          setCameraStream(stream);
          setShowCamera(true);
          setFacingMode(facing);
          
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.onloadedmetadata = () => {
              videoRef.current.play().catch(err => {
                console.error('Error playing video:', err);
                setCameraError('ไม่สามารถเริ่มต้นกล้องได้ กรุณาลองใหม่');
              });
            };
          }
        } else {
          throw specificErr;
        }
      }
    } catch (err) {
      console.error('Camera error:', err);
      setCameraError(`ไม่สามารถเข้าถึงกล้องได้: ${err.message}`);
      if (err.name === 'NotAllowedError') {
        setCameraError('กรุณาอนุญาตให้เว็บไซต์เข้าถึงกล้อง ลองรีเฟรชหน้าแล้วเลือกอนุญาต');
      } else if (err.name === 'NotFoundError') {
        setCameraError('ไม่พบกล้องในอุปกรณ์นี้');
      } else if (err.name === 'NotSupportedError') {
        setCameraError('เบราว์เซอร์ไม่รองรับการใช้กล้อง');
      }
    }
  };

  const switchCamera = () => {
    const newFacing = facingMode === 'environment' ? 'user' : 'environment';
    startCamera(newFacing);
  };

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
    setShowCamera(false);
    setCameraError("");
  };

  const capturePhoto = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    if (!video || !canvas) return;
    
    // ลดขนาดรูปภาพให้เล็กมากๆ
    const maxSize = 300; // ลดเป็น 300x300 pixels
    
    let { videoWidth, videoHeight } = video;
    
    // คำนวณขนาดใหม่โดยคงอัตราส่วน (บังคับให้เล็ก)
    const ratio = Math.min(maxSize / videoWidth, maxSize / videoHeight);
    const newWidth = Math.max(200, Math.floor(videoWidth * ratio)); // ขั้นต่ำ 200px
    const newHeight = Math.max(200, Math.floor(videoHeight * ratio)); // ขั้นต่ำ 200px
    
    // บังคับให้ไม่เกิน 300px
    const finalWidth = Math.min(300, newWidth);
    const finalHeight = Math.min(300, newHeight);
    
    canvas.width = finalWidth;
    canvas.height = finalHeight;
    
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, finalWidth, finalHeight);
    
    // ลด quality ให้ต่ำมากๆ
    const dataURL = canvas.toDataURL('image/jpeg', 0.1); // quality 10% เท่านั้น!
    
    // แปลง dataURL เป็น blob
    const byteCharacters = atob(dataURL.split(',')[1]);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: 'image/jpeg' });
    
    
    // ถ้าไฟล์ยังใหญ่เกิน 50KB ให้ลดขนาดอีก
    if (blob.size > 50 * 1024) {
      
      // ลดขนาดเป็น 200x200 และ quality 5%
      canvas.width = 200;
      canvas.height = 200;
      ctx.drawImage(video, 0, 0, 200, 200);
      
      const smallerDataURL = canvas.toDataURL('image/jpeg', 0.05); // quality 5% เท่านั้น!
      const smallerByteCharacters = atob(smallerDataURL.split(',')[1]);
      const smallerByteNumbers = new Array(smallerByteCharacters.length);
      for (let i = 0; i < smallerByteCharacters.length; i++) {
        smallerByteNumbers[i] = smallerByteCharacters.charCodeAt(i);
      }
      const smallerByteArray = new Uint8Array(smallerByteNumbers);
      const smallerBlob = new Blob([smallerByteArray], { type: 'image/jpeg' });
      
      
      const capturedFile = new File([smallerBlob], `camera-capture-${Date.now()}.jpg`, {
        type: 'image/jpeg',
        lastModified: Date.now()
      });
      
      setFile(capturedFile);
      updatePreview(capturedFile);
      setResult(null);
      setError("");
      stopCamera();
    } else {
      const capturedFile = new File([blob], `camera-capture-${Date.now()}.jpg`, {
        type: 'image/jpeg',
        lastModified: Date.now()
      });
      
      setFile(capturedFile);
      updatePreview(capturedFile);
      setResult(null);
      setError("");
      stopCamera();
    }
  };

  // Detection Functions
  const onFile = async (e) => {
    const input = e.target;
    const selected = input.files?.[0];
    if (!selected) return;
    if (!["image/jpeg", "image/png", "image/heic", "image/heif"].includes(selected.type)) {
      setError("รองรับเฉพาะ JPEG, PNG, HEIC หรือ HEIF");
      input.value = '';
      return;
    }
    setError("");
    setResult(null);
    try {
      setCompressing(true);
      const processed = await preprocessImageFile(selected);
      setFile(processed);
      updatePreview(processed);
      console.log('ข้อมูลรูปภาพที่เตรียมไว้สำหรับ detect:', {
        originalSize: selected.size,
        processedSize: processed.size,
        originalType: selected.type,
        processedType: processed.type,
      });
    } catch (prepareErr) {
      console.error('เตรียมรูปภาพสำหรับ detect ไม่สำเร็จ:', prepareErr);
      setFile(null);
      updatePreview(null);
      setError((prepareErr && prepareErr.message) || 'ไม่สามารถเตรียมรูปภาพได้');
    } finally {
      setCompressing(false);
      input.value = '';
    }
  };

  const runDetect = async () => {
    if (!file) {
      setError("กรุณาเลือกไฟล์ภาพก่อน");
      return;
    }
    
    console.log('🔍 Starting detection with file:', {
      name: file.name,
      size: file.size,
      type: file.type,
      lastModified: file.lastModified
    });
    
    setLoading(true);
    setError("");
    setResult(null);
    
    try {
      // เช็ค API connection ก่อน
      const healthCheck = await fetch(`${API_PREFIX}/health`);
      
      if (!healthCheck.ok) {
        throw new Error(`Backend server ไม่พร้อมใช้งาน (${healthCheck.status})`);
      }
      
      const res = await API.detectImage(file);
      setResult(res);
    } catch (err) {
      let errorMessage = 'เกิดข้อผิดพลาดในการตรวจจับภาพ';
      
      if (err.name === 'TypeError' && err.message.includes('fetch')) {
        errorMessage = 'ไม่สามารถเชื่อมต่อกับ Backend Server ได้';
      } else if (err.message.includes('Failed to fetch')) {
        errorMessage = 'การเชื่อมต่อขัดข้อง กรุณาตรวจสอบ Backend Server';
      } else if (err.message.includes('timeout')) {
        errorMessage = 'Request timeout - ไฟล์อาจใหญ่เกินไป';
      } else if (err.message.includes('413')) {
        errorMessage = 'ไฟล์รูปภาพมีขนาดใหญ่เกินไป';
      } else if (err.message.includes('500')) {
        errorMessage = 'เกิดข้อผิดพลาดภายใน Server';
      } else if (err.message) {
        errorMessage = err.message;
      }
      
      alert(`❌ เกิดข้อผิดพลาด: ${errorMessage}\n\nรายละเอียด:\nFile: ${file.name}\nSize: ${(file.size / 1024).toFixed(2)} KB\nError: ${err.message}`);
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const addDetectedItems = () => {
    if (!result) {
      alert("ไม่มีผลการตรวจจับ กรุณาตรวจจับภาพก่อน");
      return;
    }
    
    const newItems = [];
    const missing = [];
    
    for (const [raw, qty] of Object.entries(result.counts || {})) {
      const c = norm(raw);
      const n = Number(qty || 0);
      
      if (!n) continue;
      
      const colorEntry = colorPrices?.[c] || colorPrices?.[String(c).toLowerCase()];
      const price = Number(colorEntry?.price ?? 0);
      if (Number.isNaN(price) || price <= 0) { 
        missing.push(c); 
        continue; 
      }
      
      newItems.push({ 
        id: `color-${c}`, 
        name: COLOR_LABEL[c] || c, 
        color: c, 
        price, 
        qty: n 
      });
    }
    
    if (!newItems.length) { 
      alert("ไม่พบรายการที่มีราคา (โปรดตั้งราคาให้สีที่ต้องการก่อน)"); 
      return; 
    }
    
    if (missing.length) { 
      alert(`ยังไม่ได้ตั้งราคาให้สี: ${missing.join(", ")}`); 
    }
    
    setItems(prev => [...prev, ...newItems]);
    setCurrentStep('pos');
  };

  // Billing Functions
  const createOrder = async () => {
    if (!items.length || saving) return;
    setSaving(true);
    try {
      const payload = {
        items,
        splitMode: "NONE",
        total: getDiscountedTotal(),
        payments: [],
        paid: false,
        persons: 1, // ไม่ใช้จำนวนคนในการคำนวณราคาแล้ว
        staffName: currentUserName,
        store: { ...STORE_PROFILE, cashier: currentUserName },
        channel: "หน้าร้าน",
      };
      const res = await API.orders.create(payload);
      setOrder(res);
      setCurrentStep('billing');
    } catch (e) {
      alert(`บันทึกออเดอร์ไม่สำเร็จ: ${String(e.message || e)}`);
    } finally {
      setSaving(false);
    }
  };

  // Function to update product stock after successful payment
  const updateProductStock = async () => {
    try {
      // สร้าง array ของ updates ที่ต้องทำ
      const stockUpdates = [];
      
      for (const item of items) {
        const product = products.find(p => String(p.id) === String(item.id));
        if (product) {
          const newStock = Math.max(0, (product.stock || 0) - (item.qty || 0));
          stockUpdates.push({
            productId: product.id,
            newStock: newStock,
            productName: product.name,
            qtyUsed: item.qty || 0
          });
        }
      }

      // อัปเดท stock ในฐานข้อมูลและ local state ทีละรายการ
      for (const update of stockUpdates) {
        try {
          const product = products.find(p => String(p.id) === String(update.productId));
          if (product) {
            const updatedProduct = { ...product, stock: update.newStock };
            
            // อัปเดทฐานข้อมูล
            await API.products.update(update.productId, updatedProduct);
            
            // อัปเดท local state
            if (updateProduct) {
              updateProduct(update.productId, updatedProduct);
            }
            
            console.log(`✅ Updated stock for ${update.productName}: ${product.stock} -> ${update.newStock} (used: ${update.qtyUsed})`);
          }
        } catch (error) {
          console.error(`❌ Failed to update stock for product ${update.productId}:`, error);
          // ไม่ throw error เพื่อให้สามารถอัปเดทสินค้าอื่นต่อได้
        }
      }

      console.log(`✅ Stock update completed for ${stockUpdates.length} products`);
    } catch (error) {
      console.error('❌ Error updating product stock:', error);
      // ไม่ throw error เพื่อไม่ให้กระทบต่อขั้นตอนการชำระเงิน
    }
  };

  const confirmPayment = async () => {
    if (!order) return;
    
    // Validation สำหรับ QR payment
    if (paymentMethod === 'qr') {
      if (transferSlips.length === 0) {
        setBillingError('กรุณาอัปโหลดสลิปการโอน');
        return;
      }
      
      if (splitMode === "SPLIT" && transferSlips.length < splitPersons) {
        setBillingError(`กรุณาอัปโหลดสลิปครบ ${splitPersons} ใบ (ปัจจุบันมี ${transferSlips.length} ใบ)`);
        return;
      }
    }

    // Validation สำหรับ cash payment แบบแยกบิล
    if (paymentMethod === 'cash' && splitMode === "SPLIT") {
      if (paidPersons.length < splitPersons) {
        setBillingError(`กรุณาเช็คครบทุกคน (จ่ายแล้ว ${paidPersons.length}/${splitPersons} คน)`);
        return;
      }
    }
    
    const parts = splitMode === "SPLIT" ? splitEqual(getDiscountedTotal(), splitPersons) : [getDiscountedTotal()];
    const amountToPay = getDiscountedTotal(); // ใช้ยอดรวมหลังหักส่วนลด
    const amt = Math.round(amountToPay * 100) / 100;

    try {
      setSaving(true);
      setBillingError("");

      if (paymentMethod === "cash") {
        const rec = Number(receivedAmount || 0);
        
        if (rec < amt) {
          alert("รับเงินมาไม่พอ");
          setSaving(false);
          return;
        }
        const change = +(rec - amt).toFixed(2);

        const cashPayload = {
          method: "cash",
          amount: amt,
          received: rec,
          change,
        };

        await API.orders.addPayment(order.id, cashPayload);
        alert(`รับเงิน ${rec.toFixed(2)} บาท • เงินทอน ${change.toFixed(2)} บาท`);
      } else {
        const qrPayload = {
          method: "qr",
          amount: amt,
          received: amt,
          change: 0,
          transferSlips: transferSlips.map(slip => ({
            name: slip.name,
            size: slip.size,
            uploadTime: slip.uploadTime,
            slipUrl: slip.slipUrl, // URL ของสลิปในเซิร์ฟเวอร์
            slipId: slip.slipId || slip.id
          }))
        };

        await API.orders.addPayment(order.id, qrPayload);
        alert(`รับชำระ QR สำเร็จ (${transferSlips.length} สลิป)`);
      }

      // ตัด stock ของสินค้าที่ขายหลังจากชำระเงินสำเร็จ
      await updateProductStock();

      // Clear workflow data
      setItems([]);
      setTransferSlips([]);
      setPaidPersons([]);
      localStorage.removeItem("posCart");
      nav("/staff/orders");
    } catch (e) {
      alert(`ชำระเงินไม่สำเร็จ: ${String(e.message || e)}`);
    } finally {
      setSaving(false);
    }
  };

  // Step navigation
  const goToStep = (stepId) => {
    if (stepId === 'billing' && items.length === 0) {
      alert('กรุณาเลือกสินค้าก่อนไปหน้าชำระเงิน');
      return;
    }
    setCurrentStep(stepId);
  };

  const getCurrentStepIndex = () => {
    return WORKFLOW_STEPS.findIndex(step => step.id === currentStep);
  };

  const canGoNext = () => {
    const currentIndex = getCurrentStepIndex();
    if (currentIndex === 0) return items.length > 0; // POS -> Detect
    if (currentIndex === 1) return true; // Detect -> Billing
    return false;
  };

  const canGoPrev = () => {
    return getCurrentStepIndex() > 0;
  };

  const goNext = () => {
    const currentIndex = getCurrentStepIndex();
    if (currentIndex < WORKFLOW_STEPS.length - 1 && canGoNext()) {
      const nextStep = WORKFLOW_STEPS[currentIndex + 1].id;
      if (nextStep === 'billing') {
        createOrder();
      } else {
        setCurrentStep(nextStep);
      }
    }
  };

  const goPrev = () => {
    const currentIndex = getCurrentStepIndex();
    if (currentIndex > 0) {
      setCurrentStep(WORKFLOW_STEPS[currentIndex - 1].id);
    }
  };

  // Transfer slip functions
  const uploadSlipToServer = async (slipFile) => {
    const formData = new FormData();
    formData.append('slip', slipFile);
    
    // ใช้ order id ที่มีอยู่จริง หรือเลขฟิกซ์สำหรับ temp order
    const orderId = order?.id || 999999; // ใช้เลขใหญ่สำหรับ temp order
    formData.append('orderId', orderId);
    formData.append('timestamp', Date.now());
    
    try {
      const response = await fetch(`${API_PREFIX}/upload-slip`, {
        method: 'POST',
        body: formData
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Upload failed');
      }
      
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Failed to upload slip:', error);
      throw error;
    }
  };

  const handleSlipUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;

    setUploadingSlip(true);
    try {
      const newSlips = [];
      
      for (const file of files) {
        // อัปโหลดไฟล์ไปเซิร์ฟเวอร์
        const uploaded = await uploadSlipToServer(file);
        const slipUrl = uploaded?.slipUrl || '';
        const slipId = uploaded?.slipId;
        const storedName = uploaded?.filename || file.name;

        if (!slipUrl || !slipId) {
          throw new Error('การอัปโหลดสลิปล้มเหลว: ไม่พบข้อมูลจากเซิร์ฟเวอร์');
        }

        // สร้าง preview ของสลิป
        const reader = new FileReader();
        const preview = await new Promise((resolve) => {
          reader.onload = (e) => resolve(e.target.result);
          reader.readAsDataURL(file);
        });

        newSlips.push({
          id: slipId,
          slipId,
          file,
          preview,
          slipUrl, // URL ของสลิปในเซิร์ฟเวอร์
          name: storedName,
          size: file.size,
          uploadTime: new Date().toISOString()
        });
      }
      
      setTransferSlips(prev => [...prev, ...newSlips]);
    } catch (err) {
      console.error('Error uploading slip:', err);
      setBillingError('เกิดข้อผิดพลาดในการอัปโหลดสลิป: ' + err.message);
    } finally {
      setUploadingSlip(false);
      // Reset input
      e.target.value = '';
    }
  };

  const removeSlip = (slipId) => {
    setTransferSlips(prev => prev.filter(slip => slip.id !== slipId));
  };

  // Functions for managing split payment status
  const togglePersonPaid = (personIndex) => {
    setPaidPersons(prev => {
      if (prev.includes(personIndex)) {
        return prev.filter(p => p !== personIndex);
      } else {
        return [...prev, personIndex];
      }
    });
  };

  const resetPaidPersons = () => {
    setPaidPersons([]);
  };

  // Reset paid persons when split mode or persons count changes
  useEffect(() => {
    resetPaidPersons();
  }, [splitMode, splitPersons]);

  // ในการสร้าง order หรือชำระเงิน ให้ใช้ยอดรวมหลังหักส่วนลด
  const getDiscountedTotal = () => {
    return +(totals.total * (1 - discount / 100)).toFixed(2);
  };

  // Load QR settings
  useEffect(() => {
    (async () => {
      try {
        const data = await API.paymentSettings.get();
        setQrImage(data.qr_image || "");
        setQrLabel(data.qr_label || "");
      } catch (err) {
        setQrImage("");
        setQrLabel("");
      }
    })();
  }, []);

  if (!user || (user.role !== "STAFF" && user.role !== "ADMIN")) {
    return (
      <div className={styles.container}>
        <div className={styles.loadingState}>
          <FaSpinner className={styles.spinnerIcon} />
          <h3>กำลังตรวจสอบสิทธิ์...</h3>
        </div>
      </div>
    );
  }

  if (isLoadingData) {
    return (
      <div className={styles.container}>
        <div className={styles.loadingState}>
          <FaSpinner className={styles.spinnerIcon} />
          <h3>กำลังโหลดข้อมูลสินค้า...</h3>
        </div>
      </div>
    );
  }

  if (!products || products.length === 0) {
    return (
      <div className={styles.container}>
        <div className={styles.errorState}>
          <FaExclamationTriangle className={styles.errorIcon} />
          <h3>ไม่พบข้อมูลสินค้า</h3>
          <p>กรุณาติดต่อผู้ดูแลระบบ</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* Header with step navigation */}
      <div className={styles.header}>
        <div className={styles.welcomeSection}>
          <h1 className={styles.title}>ระบบขายหน้าร้าน</h1>
          <p className={styles.subtitle}>ยินดีต้อนรับ {currentUserName}</p>
        </div>
        
        <div className={styles.stepNavigation}>
          {WORKFLOW_STEPS.map((step, index) => {
            const Icon = step.icon;
            const isActive = step.id === currentStep;
            const isCompleted = index < getCurrentStepIndex();
            
            return (
              <button
                key={step.id}
                className={`${styles.stepButton} ${isActive ? styles.active : ''} ${isCompleted ? styles.completed : ''}`}
                onClick={() => goToStep(step.id)}
                disabled={step.id === 'billing' && items.length === 0}
              >
                <Icon className={styles.stepIcon} />
                <span className={styles.stepTitle}>{step.title}</span>
                {isCompleted && <FaCheck className={styles.completedIcon} />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main content area */}
      <div className={styles.mainContent}>
        {/* POS Step */}
        {currentStep === 'pos' && (
          <div className={styles.stepContent}>
            <div className={styles.stepHeader}>
              <FaShoppingCart className={styles.stepHeaderIcon} />
              <h2>เลือกสินค้า</h2>
            </div>

            <div className={styles.posLayout}>
              {/* Product Selection */}
              <div className={styles.productSection}>
                <h3 className={styles.sectionTitle}>รายการสินค้า</h3>
                <ProductPicker products={beverageProducts} onAdd={addProduct} />

                <div className={styles.colorSection}>
                  <h4 className={styles.colorTitle}>สีไม้ย่าง</h4>
                  {colorOptions.length === 0 ? (
                    <p className={styles.colorEmpty}>ยังไม่มีการตั้งค่าสีไม้</p>
                  ) : (
                    <div className={styles.colorGrid}>
                      {colorOptions.map((option) => {
                        const isOutOfStock = option.stock != null && option.stock <= 0;
                        return (
                          <button
                            key={option.key}
                            type="button"
                            className={`${styles.colorButton} ${isOutOfStock ? styles.colorButtonDisabled : ""}`}
                            onClick={() => addColorItem(option.key)}
                            disabled={isOutOfStock}
                            title={isOutOfStock ? "สีนี้หมดสต็อก" : option.label}
                          >
                            <span className={`${styles.colorSwatch} ${styles[`colorSwatch_${option.normalized}`] || ""}`} />
                            <span className={styles.colorMeta}>
                              <span className={styles.colorLabel}>{option.label}</span>
                              <span className={styles.colorPrice}>{option.price.toFixed(2)} ฿</span>
                            </span>
                            {option.stock != null && (
                              <span className={styles.colorStock}>คงเหลือ {option.stock} ไม้</span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Cart */}
              <div className={styles.cartSection}>
                <div className={styles.cartHeader}>
                  <h3 className={styles.sectionTitle}>ตะกร้าสินค้า</h3>
                </div>

                <div className={styles.cartItems}>
                  {items.length === 0 ? (
                    <div className={styles.emptyCart}>
                      <FaShoppingCart className={styles.emptyIcon} />
                      <p>ยังไม่มีสินค้าในตะกร้า</p>
                    </div>
                  ) : (
                    <div className={styles.itemsList}>
                      {items.map((item) => {
                        const product = products.find(p => String(p.id) === String(item.id));
                        const availableStock = product?.stock || item.stock || 0;
                        const isLowStock = availableStock <= 5;
                        const isOutOfStock = availableStock <= 0;
                        
                        return (
                          <div key={String(item.id)} className={`${styles.cartItem} ${isOutOfStock ? styles.outOfStockCartItem : ''}`}>
                            <div className={styles.itemInfo}>
                              <span className={styles.itemName}>{item.name}</span>
                              <div className={styles.itemPrice}>
                                {item.basePrice > item.price ? (
                                  <>
                                    <span className={styles.oldPrice}>
                                      {Number(item.basePrice || 0).toFixed(2)}
                                    </span>
                                    <span className={styles.newPrice}>
                                      {Number(item.price || 0).toFixed(2)}
                                    </span>
                                  </>
                                ) : (
                                  <span>{Number(item.price || 0).toFixed(2)}</span>
                                )}
                                <span className={styles.currency}>฿</span>
                              </div>
                              
                              {/* Stock indicator */}
                              <div className={styles.stockIndicator}>
                                <span className={`${styles.stockBadge} ${isOutOfStock ? styles.stockBadgeEmpty : isLowStock ? styles.stockBadgeLow : styles.stockBadgeNormal}`}>
                                  คงเหลือ: {availableStock} ชิ้น
                                </span>
                              </div>
                            </div>
                            
                            <div className={styles.quantityControls}>
                              <button
                                className={styles.qtyBtn}
                                onClick={() => changeQty(item.id, -1)}
                              >
                                <FaMinus />
                              </button>
                              <span className={styles.qtyValue}>{Number(item.qty || 0)}</span>
                              <button
                                className={styles.qtyBtn}
                                onClick={() => changeQty(item.id, 1)}
                                disabled={Number(item.qty || 0) >= availableStock}
                                title={Number(item.qty || 0) >= availableStock ? `สต็อกเหลือเพียง ${availableStock} ชิ้น` : ''}
                              >
                                <FaPlus />
                              </button>
                            </div>

                            <div className={styles.itemTotal}>
                              {(Number(item.price || 0) * Number(item.qty || 0)).toFixed(2)} ฿
                            </div>

                            <button
                              className={styles.removeBtn}
                              onClick={() => removeItem(item.id)}
                            >
                              <FaTrash />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className={styles.cartTotal}>
                  <div className={styles.totalRow}>
                    <span className={styles.totalLabel}>รวมทั้งหมด:</span>
                    <span className={styles.totalAmount}>
                      {Number(totals.total || 0).toFixed(2)} ฿
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Detect Step */}
        {currentStep === 'detect' && (
          <div className={styles.stepContent}>
            <div className={styles.stepHeader}>
              <FaRobot className={styles.stepHeaderIcon} />
              <h2>ตรวจจับไม้หม่าล่า (AI)</h2>
            </div>

            <div className={styles.detectLayout}>
              <div className={styles.uploadSection}>
                <h3 className={styles.sectionTitle}>อัปโหลดภาพ</h3>
                
                <div className={styles.fileUpload}>
                  {/* ปุ่มเลือกจากแกลเลอรี่ (ไม่มี capture) */}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/heic,image/heif"
                    onChange={onFile}
                    className={styles.fileInput}
                    id="gallery-upload"
                  />
                  <label htmlFor="gallery-upload" className={styles.fileUploadLabel}>
                    📁 เลือกรูปจากแกลเลอรี่
                  </label>
                  
                  {/* ปุ่มถ่ายรูปด้วยกล้อง (มี capture) */}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/heic,image/heif"
                    capture="environment"
                    onChange={onFile}
                    className={styles.fileInput}
                    id="camera-capture"
                  />
                  <label htmlFor="camera-capture" className={styles.cameraBtn}>
                    <FaCamera className={styles.btnIcon} />
                    ถ่ายภาพด้วยกล้อง
                  </label>
                </div>

                {cameraError && (
                  <div className={styles.errorMessage}>
                    <FaExclamationTriangle className={styles.errorIcon} />
                    {cameraError}
                  </div>
                )}

                {/* Camera Modal */}
                {showCamera && (
                  <div className={styles.cameraModal}>
                    <div className={styles.cameraContainer}>
                      <h3>📷 ถ่ายภาพ</h3>
                      
                      <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        className={styles.cameraVideo}
                      />
                      
                      <div className={styles.cameraControls}>
                        <button onClick={capturePhoto} className={styles.captureBtn}>
                          📸 ถ่ายรูป
                        </button>
                        <button onClick={switchCamera} className={styles.switchBtn}>
                          🔄 สลับกล้อง
                        </button>
                        <button onClick={stopCamera} className={styles.cancelBtn}>
                          ❌ ยกเลิก
                        </button>
                      </div>
                    </div>
                    <canvas ref={canvasRef} style={{ display: 'none' }} />
                  </div>
                )}

                {preview && (
                  <div className={styles.previewSection}>
                    <div
                      className={styles.imageContainer}
                    >
                      <img 
                        ref={imgRef} 
                        src={preview} 
                        alt="preview" 
                        className={styles.previewImage}
                        draggable={false}
                      />
                      
                    </div>

                    <div className={styles.detectActions}>
                      <button 
                        className={styles.detectBtn}
                        onClick={runDetect} 
                        disabled={!file || loading || compressing}
                      >
                        {loading ? (
                          <>
                            <FaSpinner className={`${styles.btnIcon} ${styles.spinning}`} />
                            กำลังตรวจจับ...
                          </>
                        ) : compressing ? (
                          <>
                            <FaSpinner className={`${styles.btnIcon} ${styles.spinning}`} />
                            กำลังเตรียมรูปภาพ...
                          </>
                        ) : (
                          <>
                            <FaBullseye className={styles.btnIcon} />
                            เริ่มตรวจจับ (AI)
                          </>
                        )}
                      </button>
                    </div>

                    {error && (
                      <div className={styles.errorMessage}>
                        <FaExclamationTriangle className={styles.errorIcon} />
                        {error}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className={styles.resultSection}>
                <h3 className={styles.sectionTitle}>ผลลัพธ์</h3>
                
                {!result ? (
                  <div className={styles.noResult}>
                    <FaSearch className={styles.noResultIcon} />
                    <p>อัปโหลดแล้วกดตรวจจับเพื่อดูผล</p>
                  </div>
                ) : (
                  <div className={styles.resultContent}>
                    {result.annotated && (
                      <img
                        src={`data:image/png;base64,${result.annotated}`}
                        alt="annotated"
                        className={styles.resultImage}
                      />
                    )}

                    <div className={styles.countsSection}>
                      <h4>สรุปจำนวน (สี → ราคา/ไม้):</h4>
                      <div className={styles.countsList}>
                        {Object.entries(result.counts || {}).map(([k, v]) => {
                          const c = norm(k);
                          const label = COLOR_LABEL[c] || c;
                          const colorEntry = colorPrices?.[c] || colorPrices?.[String(c).toLowerCase()];
                          const price = colorEntry?.price;
                          return (
                            <div key={k} className={styles.countItem}>
                              <span className={styles.colorLabel}>{label}</span>
                              <span className={styles.priceLabel}>{price ?? "—"}฿</span>
                              <span className={styles.stockLabelSmall}>สต็อก: {colorEntry?.stock ?? '—'}</span>
                              <span className={styles.multiplyLabel}>x</span>
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
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <button 
                      className={styles.addToCartBtn}
                      onClick={addDetectedItems}
                    >
                      <FaPlus className={styles.btnIcon} />
                      เพิ่มเข้าตะกร้า
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Billing Step */}
        {currentStep === 'billing' && (
          <div className={styles.stepContent}>
            <div className={styles.stepHeader}>
              <FaCreditCard className={styles.stepHeaderIcon} />
              <h2>ชำระเงิน</h2>
            </div>

            <div className={styles.billingLayout}>
              {/* Order Summary */}
              <div className={styles.summarySection}>
                <h3 className={styles.sectionTitle}>สรุปรายการ</h3>
                {order && (
                  <div className={styles.orderNumber}>
                    เลขที่ #{order.id}
                  </div>
                )}

                <div className={styles.itemsSummary}>
                  {items.map((item) => (
                    <div key={String(item.id)} className={styles.summaryItem}>
                      <span className={styles.itemName}>{item.name}</span>
                      <span className={styles.itemPrice}>
                        {Number(item.price).toFixed(2)} ฿
                      </span>
                      <span className={styles.itemQty}>x{item.qty}</span>
                      <span className={styles.itemTotal}>
                        {(Number(item.price) * Number(item.qty)).toFixed(2)} ฿
                      </span>
                    </div>
                  ))}
                </div>

                <div className={styles.discountSection}>
                  <label htmlFor="discountInput" className={styles.discountLabel}>ส่วนลด (%):</label>
                  <input
                    id="discountInput"
                    type="number"
                    min={0}
                    max={100}
                    value={discount}
                    onChange={e => setDiscount(Math.max(0, Math.min(100, Number(e.target.value))))}
                    className={styles.discountInput}
                    placeholder="เช่น 10"
                  />
                </div>

                <div className={styles.grandTotal}>
                  <span className={styles.totalLabel}>ยอดรวมทั้งสิ้น:</span>
                  <span className={styles.totalAmount}>
                    {discount > 0
                      ? `${totals.total.toFixed(2)} ฿ - ส่วนลด ${discount}% = ${(totals.total * (1 - discount / 100)).toFixed(2)} ฿`
                      : `${totals.total.toFixed(2)} ฿`}
                  </span>
                </div>

                {/* Split Options */}
                <div className={styles.splitOptions}>
                  <h4 className={styles.splitTitle}>🧾 ตัวเลือกการชำระเงิน</h4>
                  
                  <div className={styles.splitModeSelect}>
                    <label className={`${styles.splitOption} ${splitMode === "NONE" ? styles.active : ""}`}>
                      <input
                        type="radio"
                        name="splitMode"
                        checked={splitMode === "NONE"}
                        onChange={() => setSplitMode("NONE")}
                      />
                      <div className={styles.optionContent}>
                        <span className={styles.optionIcon}>💰</span>
                        <div className={styles.optionText}>
                          <strong>จ่ายรวม</strong>
                          <small>ชำระเงินรวมทั้งหมด</small>
                        </div>
                      </div>
                    </label>
                    
                    <label className={`${styles.splitOption} ${splitMode === "SPLIT" ? styles.active : ""}`}>
                      <input
                        type="radio"
                        name="splitMode"
                        checked={splitMode === "SPLIT"}
                        onChange={() => setSplitMode("SPLIT")}
                      />
                      <div className={styles.optionContent}>
                        <span className={styles.optionIcon}>👥</span>
                        <div className={styles.optionText}>
                          <strong>แยกบิลเท่ากัน</strong>
                          <small>แบ่งจ่ายเฉลี่ยกันทุกคน</small>
                        </div>
                      </div>
                    </label>
                  </div>

                  {splitMode === "SPLIT" && (
                    <div className={styles.splitConfiguration}>
                      <div className={styles.splitPersonsCard}>
                        <div className={styles.personCounterSection}>
                          <span className={styles.personLabel}>👥 จำนวนคน</span>
                          <div className={styles.counterControls}>
                            <button
                              className={styles.counterBtn}
                              onClick={() => setSplitPersons(n => Math.max(1, n - 1))}
                              disabled={splitPersons <= 1}
                            >
                              <FaMinus />
                            </button>
                            <span className={styles.counterValue}>{splitPersons}</span>
                            <button
                              className={styles.counterBtn}
                              onClick={() => setSplitPersons(n => Math.min(20, n + 1))}
                              disabled={splitPersons >= 20}
                            >
                              <FaPlus />
                            </button>
                          </div>
                        </div>

                        <div className={styles.splitSummaryCard}>
                          <div className={styles.summaryHeader}>
                            <span className={styles.summaryIcon}>📊</span>
                            <span>สรุปการแยกบิล</span>
                          </div>
                          <div className={styles.splitDetails}>
                            <div className={styles.splitRow}>
                              <span>💵 แต่ละคนจ่าย:</span>
                              <span className={styles.splitAmount}>
                                {splitEqual(getDiscountedTotal(), splitPersons)[0].toFixed(2)} ฿
                              </span>
                            </div>
                            <div className={styles.splitRow}>
                              <span>👥 จำนวน {splitPersons} คน</span>
                              <span className={styles.splitTotal}>
                                รวม: {getDiscountedTotal().toFixed(2)} ฿
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Payment Section */}
              <div className={styles.paymentSection}>
                <h3 className={styles.sectionTitle}>การชำระเงิน</h3>

                {billingError && (
                  <div className={styles.errorMessage}>
                    <FaExclamationTriangle className={styles.errorIcon} />
                    {billingError}
                  </div>
                )}

                <div className={styles.paymentMethods}>
                  <button
                    className={`${styles.paymentMethod} ${paymentMethod === 'cash' ? styles.active : ''}`}
                    onClick={() => setPaymentMethod('cash')}
                  >
                    <FaMoneyBillWave className={styles.methodIcon} />
                    เงินสด
                  </button>
                  <button
                    className={`${styles.paymentMethod} ${paymentMethod === 'qr' ? styles.active : ''}`}
                    onClick={() => setPaymentMethod('qr')}
                  >
                    <FaQrcode className={styles.methodIcon} />
                    QR พร้อมเพย์
                  </button>
                </div>

                {paymentMethod === 'cash' && (
                  <div className={styles.cashPayment}>
                    {splitMode === "SPLIT" && (
                      <div className={styles.splitPaymentTracker}>
                        <div className={styles.trackerHeader}>
                          <span className={styles.trackerIcon}>✅</span>
                          <h4>ติดตามการจ่ายเงิน</h4>
                        </div>
                        
                        <div className={styles.paymentProgress}>
                          <div className={styles.progressInfo}>
                            <span>จ่ายแล้ว: <strong>{paidPersons.length}/{splitPersons}</strong> คน</span>
                            <span className={styles.remainingAmount}>
                              เหลือ: <strong>{(getDiscountedTotal() * (splitPersons - paidPersons.length) / splitPersons).toFixed(2)} ฿</strong>
                            </span>
                          </div>
                          <div className={styles.progressBar}>
                            <div 
                              className={styles.progressFill}
                              style={{ width: `${(paidPersons.length / splitPersons) * 100}%` }}
                            />
                          </div>
                        </div>

                        <div className={styles.personCheckboxes}>
                          {Array.from({ length: splitPersons }, (_, index) => {
                            const isPaid = paidPersons.includes(index);
                            const amount = splitEqual(getDiscountedTotal(), splitPersons)[0];
                            
                            return (
                              <label 
                                key={index} 
                                className={`${styles.personCheckbox} ${isPaid ? styles.paid : ''}`}
                              >
                                <input
                                  type="checkbox"
                                  checked={isPaid}
                                  onChange={() => togglePersonPaid(index)}
                                  className={styles.checkbox}
                                />
                                <div className={styles.personInfo}>
                                  <div className={styles.personHeader}>
                                    <span className={styles.personNumber}>👤 คนที่ {index + 1}</span>
                                    {isPaid && <span className={styles.paidBadge}>✅ จ่ายแล้ว</span>}
                                  </div>
                                  <div className={styles.personAmount}>
                                    {amount.toFixed(2)} ฿
                                  </div>
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    <div className={styles.amountField}>
                      <label>รับเงินมา (บาท)</label>
                      <input
                        type="number"
                        value={receivedAmount}
                        onChange={(e) => setReceivedAmount(parseFloat(e.target.value) || 0)}
                        className={styles.amountInput}
                      />
                    </div>

                    <div className={styles.changeCalculation}>
                      <div className={styles.changeRow}>
                        <span>ต้องชำระ:</span>
                        <span className={styles.amount}>
                          {getDiscountedTotal().toFixed(2)} ฿
                        </span>
                      </div>
                      <div className={styles.changeRow}>
                        <span>เงินทอน:</span>
                        <span className={styles.amount}>
                          {Math.max(0, receivedAmount - getDiscountedTotal()).toFixed(2)} ฿
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {paymentMethod === 'qr' && (
                  <div className={styles.qrPayment}>
                    <div className={styles.qrHeader}>
                      {qrImage ? (
                        <div className={styles.qrContainer}>
                          <img 
                            src={qrImage} 
                            alt="QR Code สำหรับชำระเงิน" 
                            className={styles.qrImage}
                          />
                          <p className={styles.qrLabel}>
                            {qrLabel || 'สแกนจ่ายด้วยพร้อมเพย์'}
                          </p>
                        </div>
                      ) : (
                        <div className={styles.qrPlaceholder}>
                          <div className={styles.qrIcon}>📱</div>
                          <p className={styles.qrNote}>
                            ยังไม่มี QR Code - กรุณาติดต่อแอดมินเพื่อตั้งค่า
                          </p>
                        </div>
                      )}
                      
                      <div className={styles.paymentAmount}>
                        <span>ยอดที่ต้องชำระ: </span>
                        <strong>
                          {getDiscountedTotal().toFixed(2)} ฿
                        </strong>
                      </div>
                    </div>

                    <div className={styles.slipUploadSection}>
                      <h4>อัปโหลดสลิปการโอน:</h4>
                      
                      <div className={styles.uploadArea}>
                        <input
                          type="file"
                          id="slip-upload"
                          accept="image/*"
                          multiple
                          onChange={handleSlipUpload}
                          className={styles.slipInput}
                          disabled={uploadingSlip}
                        />
                        <label htmlFor="slip-upload" className={styles.uploadLabel}>
                          {uploadingSlip ? (
                            <>
                              <FaSpinner className={`${styles.uploadIcon} ${styles.spinning}`} />
                              กำลังอัปโหลด...
                            </>
                          ) : (
                            <>
                              <FaPlus className={styles.uploadIcon} />
                              เลือกสลิปการโอน
                            </>
                          )}
                        </label>
                      </div>

                      {transferSlips.length > 0 && (
                        <div className={styles.slipsList}>
                          <h5>สลิปที่อัปโหลด ({transferSlips.length} ใบ):</h5>
                          <div className={styles.slipsGrid}>
                            {transferSlips.map((slip) => (
                              <div key={slip.id} className={styles.slipItem}>
                                <div className={styles.slipPreview}>
                                  <img 
                                    src={slip.preview} 
                                    alt={slip.name}
                                    className={styles.slipImage}
                                  />
                                  <button 
                                    className={styles.removeSlipBtn}
                                    onClick={() => removeSlip(slip.id)}
                                  >
                                    <FaTrash />
                                  </button>
                                </div>
                                <div className={styles.slipInfo}>
                                  <span className={styles.slipName}>{slip.name}</span>
                                  <span className={styles.slipSize}>
                                    {(slip.size / 1024).toFixed(1)} KB
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {splitMode === "SPLIT" && transferSlips.length > 0 && transferSlips.length < splitPersons && (
                        <div className={styles.slipWarning}>
                          <FaExclamationTriangle className={styles.warningIcon} />
                          <span>ยังขาดสลิป: อัปโหลดแล้ว {transferSlips.length} จาก {splitPersons} ใบ</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer with navigation */}
      <div className={styles.footer}>
        <div className={styles.navigationButtons}>
          <button
            className={styles.navBtn}
            onClick={goPrev}
            disabled={!canGoPrev()}
          >
            <FaArrowLeft className={styles.btnIcon} />
            ย้อนกลับ
          </button>

          <div className={styles.stepIndicator}>
            ขั้นตอนที่ {getCurrentStepIndex() + 1} จาก {WORKFLOW_STEPS.length}
          </div>

          {currentStep === 'billing' ? (
            <button
              className={styles.confirmBtn}
              onClick={confirmPayment}
              disabled={saving || !order || (paymentMethod === 'cash' && splitMode === "SPLIT" && paidPersons.length < splitPersons)}
            >
              {saving ? (
                <>
                  <FaSpinner className={`${styles.btnIcon} ${styles.spinning}`} />
                  กำลังบันทึก...
                </>
              ) : (
                <>
                  <FaCheck className={styles.btnIcon} />
                  ยืนยันการชำระเงิน
                  {paymentMethod === 'cash' && splitMode === "SPLIT" && paidPersons.length < splitPersons && (
                    <span className={styles.incompletePayment}> ({paidPersons.length}/{splitPersons})</span>
                  )}
                </>
              )}
            </button>
          ) : (
            <button
              className={styles.navBtn}
              onClick={goNext}
              disabled={!canGoNext() || saving}
            >
              {saving ? (
                <>
                  <FaSpinner className={`${styles.btnIcon} ${styles.spinning}`} />
                  กำลังบันทึก...
                </>
              ) : (
                <>
                  ถัดไป
                  <FaArrowRight className={styles.btnIcon} />
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

