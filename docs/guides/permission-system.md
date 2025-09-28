// การใช้งาน Permission System ในระบบ Mala Restaurant

## ✅ สิ่งที่เรามีแล้ว:

### 1. ระบบ Permissions ใน Users.jsx
```javascript
const PERMISSIONS = [
  { key: 'pos',            label: 'หน้าขาย (POS)' },
  { key: 'products',       label: 'สินค้า' },
  { key: 'users',          label: 'ผู้ใช้งาน' },
  { key: 'announcements',  label: 'ประกาศ' },
  { key: 'reports',        label: 'รายงาน/สรุป' },
]

const ROLE_PRESETS = {
  ADMIN: ['pos', 'products', 'users', 'announcements', 'reports'], // เข้าได้ทุกหน้า
  STAFF: ['pos', 'products']                                       // เข้าได้เฉพาะ POS และสินค้า
}
```

### 2. การกำหนดสิทธิ์ในหน้า Admin → จัดการผู้ใช้
- ✅ Admin สามารถกำหนดสิทธิ์ให้ Staff แต่ละคนได้
- ✅ สามารถเลือกสิทธิ์แบบเฉพาะเจาะจงได้
- ✅ มีปุ่ม "เลือกทั้งหมด", "ล้าง", "ใช้ค่าเริ่มต้น"

### 3. ระบบป้องกันการเข้าถึง
- ✅ **PermissionGuard Component** - ตรวจสอบสิทธิ์ก่อนแสดงหน้า
- ✅ **usePermissions Hook** - Helper สำหรับตรวจสอบสิทธิ์
- ✅ **AdminNavigation** - ซ่อนเมนูที่ไม่มีสิทธิ์เข้าถึง
- ✅ **App.jsx Routes** - ป้องกันการเข้าถึงหน้าต่างๆ

### 4. การทำงานของระบบ

#### 🔑 **Admin (ผู้ดูแลระบบ):**
```javascript
role: "ADMIN"
permissions: ['pos', 'products', 'users', 'announcements', 'reports']
```
- ✅ เข้าได้ทุกหน้า (POS, สินค้า, ผู้ใช้งาน, ประกาศ, รายงาน)
- ✅ เห็นเมนูครบทุกตัว
- ✅ กำหนดสิทธิ์ให้คนอื่นได้

#### 👥 **Staff (พนักงาน):**
```javascript
role: "STAFF"
permissions: ['pos', 'products']  // ค่าเริ่มต้น
```
- ✅ เข้าได้เฉพาะ POS และสินค้า
- ❌ เข้าหน้าผู้ใช้งาน, ประกาศ, รายงาน ไม่ได้
- ✅ เมนูจะซ่อนหน้าที่ไม่มีสิทธิ์

#### 🎯 **Staff (กำหนดสิทธิ์เพิ่ม):**
```javascript
role: "STAFF" 
permissions: ['pos', 'products', 'announcements']  // Admin เพิ่มสิทธิ์ประกาศให้
```
- ✅ เข้าได้ POS, สินค้า, และประกาศ
- ❌ เข้าหน้าผู้ใช้งาน, รายงาน ไม่ได้

### 5. ตัวอย่างการใช้งาน

#### ในหน้า Admin → จัดการผู้ใช้:
1. Admin สร้าง Staff ใหม่
2. เลือกสิทธิ์ที่ต้องการ (เช่น เลือกเฉพาะ POS และสินค้า)
3. บันทึก → Staff คนนั้นจะเข้าได้เฉพาะหน้าที่มีสิทธิ์

#### ในการใช้งานจริง:
1. Staff login เข้าระบบ
2. ระบบจะแสดงเฉพาะเมนูที่มีสิทธิ์
3. ถ้าพยายามเข้าหน้าที่ไม่มีสิทธิ์ → แสดงหน้า "ไม่มีสิทธิ์เข้าถึง"

### 6. การป้องกันหลายชั้น

#### ชั้นที่ 1: Navigation (AdminNavigation.jsx)
- ซ่อนเมนูที่ไม่มีสิทธิ์เข้าถึง

#### ชั้นที่ 2: Routes (App.jsx)  
- ใช้ PermissionGuard ตรวจสอบสิทธิ์

#### ชั้นที่ 3: Component Level
- สามารถใช้ usePermissions Hook ตรวจสอบเพิ่มได้

```javascript
import usePermissions from '../hooks/usePermissions.js'

function MyComponent() {
  const { hasPermission } = usePermissions()
  
  return (
    <div>
      {hasPermission('users') && (
        <button>จัดการผู้ใช้งาน</button>
      )}
    </div>
  )
}
```

## 🎉 **สรุป: ทำได้จริง 100%**

ระบบนี้ครบถ้วนและใช้งานได้จริงแล้ว:
- ✅ Admin เข้าได้ทุกหน้า
- ✅ Staff เข้าได้เฉพาะหน้าที่มีสิทธิ์
- ✅ Admin กำหนดสิทธิ์ให้ Staff ได้
- ✅ มีการป้องกันหลายชั้น
- ✅ UI/UX ที่เป็นมิตรกับผู้ใช้