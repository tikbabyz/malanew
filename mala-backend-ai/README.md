# Mala AI Backend (Flask + YOLOv11)

ติดตั้ง:
```bash
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
```
วางไฟล์โมเดลที่คุณเทรนแล้ว เช่น `best.pt` ในโฟลเดอร์นี้ หรือกำหนด path ผ่าน env `MALA_MODEL_PATH` แล้วรัน:
```bash
python server.py
```
เริ่มใช้งานที่ http://127.0.0.1:8000
- GET /api/health
- POST /api/detect (multipart/form-data ชื่อฟิลด์: image)
