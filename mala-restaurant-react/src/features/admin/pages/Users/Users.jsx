import React from 'react'
import { useDataStore } from '@store/data.js'
import ConfirmModal from "@shared/components/ConfirmModal/ConfirmModal.jsx"
import styles from './Users.module.css'
import { makePasswordHash } from '@utils/hash.js'
import {
  FaUsers, 
  FaUserPlus, 
  FaEdit, 
  FaTrash, 
  FaSave, 
  FaTimes, 
  FaEye, 
  FaEyeSlash,
  FaUserShield,
  FaUserTie,
  FaPhone,
  FaEnvelope,
  FaKey,
  FaUserEdit,
  FaCheckCircle,
  FaTimesCircle,
  FaShieldAlt,
  FaCog,
  FaSpinner,
  FaExclamationTriangle
} from 'react-icons/fa'


const PASSWORD_RULES = [
  { key: 'length', label: 'อย่างน้อย 8 ตัวอักษร', test: (pwd) => pwd.length >= 8 },
  { key: 'uppercase', label: 'มีตัวอักษรพิมพ์ใหญ่ (A-Z)', test: (pwd) => /[A-Z]/.test(pwd) },
  { key: 'lowercase', label: 'มีตัวอักษรพิมพ์เล็ก (a-z)', test: (pwd) => /[a-z]/.test(pwd) },
  { key: 'number', label: 'มีตัวเลข (0-9)', test: (pwd) => /[0-9]/.test(pwd) },
  { key: 'special', label: 'มีอักขระพิเศษ (!@#$...)', test: (pwd) => /[^A-Za-z0-9]/.test(pwd) }
]

const analyzePassword = (pwd = '') => {
  const password = pwd || ''
  const checks = PASSWORD_RULES.map((rule) => ({
    key: rule.key,
    label: rule.label,
    passed: rule.test(password)
  }))

  const score = checks.filter((rule) => rule.passed).length
  const max = checks.length
  const issues = checks.filter((rule) => !rule.passed).map((rule) => rule.label)

  let level = 'weak'
  let label = 'รหัสผ่านอ่อน'

  if (!password) {
    level = 'weak'
    label = 'ยังไม่ได้ตั้งรหัสผ่าน'
  } else if (score <= 2) {
    level = 'weak'
    label = 'รหัสผ่านอ่อน'
  } else if (score === 3) {
    level = 'fair'
    label = 'รหัสผ่านปานกลาง'
  } else if (score === 4) {
    level = 'good'
    label = 'รหัสผ่านค่อนข้างดี'
  } else if (score === 5) {
    level = 'strong'
    label = 'รหัสผ่านปลอดภัย'
  }

  return {
    level,
    label,
    score,
    max,
    issues,
    checks
  }
}


/** ===== Permissions & Role presets ===== */
const PERMISSIONS = [
  { key: 'pos',            label: 'หน้าขาย (POS)' },
  { key: 'products',       label: 'สินค้า' },
  { key: 'users',          label: 'ผู้ใช้งาน' },
  { key: 'announcements',  label: 'ประกาศ' },
  { key: 'reports',        label: 'รายงาน/สรุป' },
]

const ROLE_PRESETS = {
  ADMIN: PERMISSIONS.map(p => p.key),            // สิทธิ์ครบทุกอย่าง
  STAFF: ['pos', 'products'],                    // สิทธิ์หลักสำหรับพนักงาน
}

const permsFromRole = (role) => {
  const set = new Set(ROLE_PRESETS[role] || [])
  return Object.fromEntries(PERMISSIONS.map(p => [p.key, set.has(p.key)]))
}

const normalizePermsObj = (perms, role) => {
  if (typeof perms === 'string') {
    try { perms = JSON.parse(perms) } catch { perms = null }
  }
  if (Array.isArray(perms)) {
    return Object.fromEntries(PERMISSIONS.map(p => [p.key, perms.includes(p.key)]))
  }
  if (perms && typeof perms === 'object') return perms
  return permsFromRole(role || 'STAFF')
}
const tagsFromPerms = (perms) => {
  if (typeof perms === 'string') {
    try { perms = JSON.parse(perms) } catch { perms = {} }
  }
  if (Array.isArray(perms)) {
    return PERMISSIONS.filter(p => perms.includes(p.key)).map(p => p.label)
  }
  if (perms && typeof perms === 'object') {
    return PERMISSIONS.filter(p => !!perms[p.key]).map(p => p.label)
  }
  return []
}



export default function Users(){
  const { users, addUser, updateUser, deleteUser, loadUsers } = useDataStore()

  const [editId, setEditId] = React.useState(null)
  const [showPassword, setShowPassword] = React.useState(false)
  const [showDeleteModal, setShowDeleteModal] = React.useState(false)
  const [userToDelete, setUserToDelete] = React.useState(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState('')
  const [form, setForm] = React.useState({
    username:'', password:'', name:'', role:'STAFF', active:true, phone:'', email:'',
    perms: permsFromRole('STAFF'),
  })
  const [errors, setErrors] = React.useState({})

  // โหลดข้อมูล users จากฐานข้อมูลตอนเริ่มต้น
  React.useEffect(() => {
    const loadInitialData = async () => {
      try {
        setLoading(true)
        setError('')
        await loadUsers()
      } catch (err) {
        setError('ไม่สามารถโหลดข้อมูลผู้ใช้งานได้: ' + err.message)
      } finally {
        setLoading(false)
      }
    }
    
    loadInitialData()
  }, [])

  /** ========= password strength checker ========= */
  const passwordStrength = React.useMemo(
    () => analyzePassword(form.password || ''),
    [form.password]
  )

  /** ========= validate ========= */
  const validate = () => {
    const e = {}
    const trimmedUsername = form.username?.trim() || ''
    const trimmedPassword = form.password?.trim() || ''

    if (!trimmedUsername) e.username = 'กรุณากรอกชื่อผู้ใช้'
    if (!editId && !trimmedPassword) e.password = 'กรุณาตั้งรหัสผ่าน'
    if (!form.name?.trim()) e.name = 'กรุณากรอกชื่อ-นามสกุล'
    if (!form.role) e.role = 'กรุณาเลือกสิทธิ์การเข้าถึง'

    // เช็คความปลอดภัยเฉพาะตอน "สร้างใหม่" หรือถ้ากรอกจะเปลี่ยนรหัส
    if (trimmedPassword) {
      const issues = analyzePassword(trimmedPassword).issues
      if (issues.length) e.password = `รหัสผ่านไม่ปลอดภัย: ${issues.join(' · ')}`
    }

    setErrors(e)
    return Object.keys(e).length === 0
  }

  /** ========= role change -> apply preset (ยังปรับแต่งเองต่อได้) ========= */
  const handleRoleChange = (role) => {
    setForm(f => ({ ...f, role, perms: permsFromRole(role) }))
    setErrors(e => ({ ...e, role: undefined }))
  }

  /** ========= delete confirmation ========= */
  const handleDeleteClick = (user) => {
    setUserToDelete(user)
    setShowDeleteModal(true)
  }

  const handleDeleteConfirm = async () => {
    if (userToDelete) {
      try {
        setLoading(true)
        setError('')
        await deleteUser(userToDelete.id)
        setShowDeleteModal(false)
        setUserToDelete(null)
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
  }

  /** ========= edit ========= */
  const handleEdit = (u) => {
    setEditId(u.id)
    setForm({
      username: u.username,
      password: '', // ไม่แสดงรหัสผ่านเดิม เพื่อความปลอดภัย
      name: u.name,
      role: u.role || 'STAFF',
      active: !!u.active,
      phone: u.phone || '',
      email: u.email || '',
      perms: normalizePermsObj(u.perms, u.role),

    })
    setErrors({})
  }

  /** ========= save ========= */
  const handleSave = async () => {
    if (!validate()) return
    
    try {
      setLoading(true)
      setError('')
      const payload = { ...form, perms: normalizePermsObj(form.perms, form.role) }

      if (editId) {
        const existing = (users || []).find(u => u.id === editId) || {}
        const passwordHash = form.password?.trim()
         ? await makePasswordHash(form.password.trim())
         : existing.passwordHash || existing.password
        await updateUser({ id: editId, ...payload, passwordHash })
      } else {
        const passwordHash = await makePasswordHash(form.password.trim())
        await addUser({ ...payload, passwordHash })
      }

      setForm({
        username:'', password:'', name:'', role:'STAFF', active:true, phone:'', email:'',
        perms: permsFromRole('STAFF'),
      })
      setEditId(null)
      setErrors({})
      setShowPassword(false)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  /** ========= helpers ========= */
  const togglePerm = (key) =>
    setForm(f => ({ ...f, perms: { ...f.perms, [key]: !f.perms?.[key] } }))

  const setAllPerms = (value) =>
    setForm(f => ({
      ...f,
      perms: Object.fromEntries(PERMISSIONS.map(p => [p.key, value]))
    }))

  return(
    <div className={styles.usersContainer}>      
      {/* Error Display */}
      {error && (
        <div className={styles.errorBanner}>
          <FaExclamationTriangle className={styles.errorIcon} />
          {error}
        </div>
      )}
      
      {/* Loading State */}
      {loading && (
        <div className={styles.loadingBanner}>
          <FaSpinner className={styles.spinner} />
          กำลังโหลดข้อมูล...
        </div>
      )}
      
      {/* Header Section */}
      <div className={styles.usersHeader}>
        <div className={styles.headerContent}>
          <div className={styles.headerMain}>
            <h1 className={styles.pageTitle}>
              <FaUsers className={styles.titleIcon} />
              จัดการผู้ใช้งาน
            </h1>
            <p className={styles.pageSubtitle}>
              เพิ่ม แก้ไข และจัดการสิทธิ์ผู้ใช้งานในระบบ ({users.length} คน)
            </p>
          </div>
          <div className={styles.headerStats}>
            <div className={styles.statCard}>
              <FaUserShield className={styles.statIcon} />
              <div>
                <span className={styles.statNumber}>{users.filter(u => u.role === 'ADMIN').length}</span>
                <span className={styles.statLabel}>ผู้ดูแลระบบ</span>
              </div>
            </div>
            <div className={styles.statCard}>
              <FaUserTie className={styles.statIcon} />
              <div>
                <span className={styles.statNumber}>{users.filter(u => u.role === 'STAFF').length}</span>
                <span className={styles.statLabel}>พนักงาน</span>
              </div>
            </div>
            <div className={styles.statCard}>
              <FaCheckCircle className={styles.statIcon} />
              <div>
                <span className={styles.statNumber}>{users.filter(u => u.active).length}</span>
                <span className={styles.statLabel}>ใช้งานอยู่</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className={styles.usersGridContainer}>
        <div className={styles.usersGrid}>

        {/* ====== Form Card ====== */}
        <div className={styles.card}>
          <div className={styles.headerRow}>
            <h2 className={styles.title}>
              {editId ? (
                <>
                  <FaUserEdit className={styles.titleIcon} />
                  แก้ไขผู้ใช้งาน
                </>
              ) : (
                <>
                  <FaUserPlus className={styles.titleIcon} />
                  เพิ่มผู้ใช้งานใหม่
                </>
              )}
            </h2>

            <div className={styles.statusChip}>
              <span className={styles.statusLabel}>
                {form.active ? <FaCheckCircle /> : <FaTimesCircle />}
                สถานะ
              </span>
              <label className={styles.switch}>
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={e=>setForm({...form,active:e.target.checked})}
                />
                <span className={styles.slider}></span>
              </label>
            </div>
          </div>

          <div className={styles.formCol}>
            <div className={styles.field}>
              <label>
                <FaUserEdit className={styles.fieldIcon} />
                ชื่อผู้ใช้
              </label>
              <input
                className={`${styles.input} ${errors.username?styles.inputInvalid:''}`}
                placeholder="เช่น staff001"
                value={form.username}
                onChange={e=>setForm({...form,username:e.target.value})}
              />
              {errors.username && <p className={styles.errorText}>{errors.username}</p>}
            </div>

            <div className={styles.field}>
              <label>
                <FaKey className={styles.fieldIcon} />
                รหัสผ่าน{editId ? ' (แก้ไขได้)' : ''}
              </label>
              <div className={styles.passwordField}>
                <input
                  type={showPassword ? "text" : "password"}
                  className={`${styles.input} ${errors.password?styles.inputInvalid:''}`}
                  placeholder={editId ? 'เว้นว่างหากไม่ต้องการเปลี่ยน' : 'ตั้งรหัสผ่าน'}
                  value={form.password}
                  onChange={(e) => {
                    const value = e.target.value
                    setForm((prev) => ({ ...prev, password: value }))
                    if (errors.password) {
                      setErrors((prev) => {
                        const next = { ...prev }
                        delete next.password
                        return next
                      })
                    }
                  }}
                />
                <button
                  type="button"
                  className={styles.passwordToggle}
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <FaEyeSlash /> : <FaEye />}
                </button>
              </div>
              {errors.password && <p className={styles.errorText}>{errors.password}</p>}
              {form.password && (
                <div className={`${styles.passwordStrength} ${styles[passwordStrength.level]}`}>
                  <div className={styles.passwordStrengthHeader}>
                    <span className={styles.passwordStrengthLabel}>{passwordStrength.label}</span>
                    <span className={styles.passwordStrengthScore}>
                      {passwordStrength.score}/{passwordStrength.max}
                    </span>
                  </div>
                  <div className={styles.passwordStrengthBar}>
                    <div
                      className={styles.passwordStrengthFill}
                      style={{ width: `${(passwordStrength.score / passwordStrength.max) * 100}%` }}
                    />
                  </div>
                  <ul className={styles.passwordChecklist}>
                    {passwordStrength.checks.map((rule) => (
                      <li
                        key={rule.key}
                        className={`${styles.passwordChecklistItem} ${rule.passed ? styles.pass : styles.fail}`}
                      >
                        {rule.passed ? (
                          <FaCheckCircle className={styles.checkIcon} />
                        ) : (
                          <FaTimesCircle className={styles.checkIcon} />
                        )}
                        <span>{rule.label}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div className={styles.field}>
              <label>
                <FaUserTie className={styles.fieldIcon} />
                ชื่อ-นามสกุล
              </label>
              <input
                className={`${styles.input} ${errors.name?styles.inputInvalid:''}`}
                placeholder="ชื่อจริง นามสกุล"
                value={form.name}
                onChange={e=>setForm({...form,name:e.target.value})}
              />
              {errors.name && <p className={styles.errorText}>{errors.name}</p>}
            </div>

            <div className={styles.field}>
              <label>
                <FaPhone className={styles.fieldIcon} />
                เบอร์โทรศัพท์
              </label>
              <input
                className={styles.input}
                placeholder="0xx-xxx-xxxx"
                value={form.phone}
                onChange={e=>setForm({...form,phone:e.target.value})}
              />
            </div>

            <div className={styles.field}>
              <label>
                <FaEnvelope className={styles.fieldIcon} />
                อีเมล
              </label>
              <input
                type="email"
                className={styles.input}
                placeholder="name@example.com"
                value={form.email}
                onChange={e=>setForm({...form,email:e.target.value})}
              />
            </div>

            <div className={styles.field}>
              <label>
                <FaShieldAlt className={styles.fieldIcon} />
                บทบาท (Role)
              </label>
              <select
                className={`${styles.input} ${errors.role?styles.inputInvalid:''}`}
                value={form.role}
                onChange={e=>handleRoleChange(e.target.value)}
              >
                <option value="STAFF">พนักงาน</option>
                <option value="ADMIN">ผู้ดูแลระบบ</option>
              </select>
              {errors.role && <p className={styles.errorText}>{errors.role}</p>}
            </div>
          </div>

          {/* ====== Permissions ====== */}
          <div className={styles.permCard}>
            <div className={styles.permHeader}>
              <h3>
                <FaCog className={styles.titleIcon} />
                กำหนดสิทธิ์การใช้งาน
              </h3>
              <div className={styles.permActions}>
                <button className={styles.btnGhostSm} onClick={()=>setAllPerms(true)}>
                  <FaCheckCircle />
                  เลือกทั้งหมด
                </button>
                <button className={styles.btnGhostSm} onClick={()=>setAllPerms(false)}>
                  <FaTimesCircle />
                  ล้าง
                </button>
                <button className={styles.btnGhostSm} onClick={()=>setForm(f=>({ ...f, perms: permsFromRole(f.role) }))}>
                  <FaShieldAlt />
                  ใช้ค่าเริ่มต้นของ {form.role==='ADMIN'?'ADMIN':'STAFF'}
                </button>
              </div>
            </div>

            <div className={styles.permGrid}>
              {PERMISSIONS.map(p => (
                <label key={p.key} className={`${styles.permItem} ${form.perms?.[p.key]?styles.permOn:''}`}>
                  <input
                    type="checkbox"
                    checked={!!form.perms?.[p.key]}
                    onChange={()=>togglePerm(p.key)}
                  />
                  <span className={styles.permLabel}>{p.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className={styles.actionsRow}>
            <button className={styles.btn} onClick={handleSave}>
              <FaSave />
              {editId ? 'บันทึกการแก้ไข' : 'เพิ่มผู้ใช้งาน'}
            </button>
            {editId && (
              <button
                className={styles.btnSecondary}
                onClick={()=>{
                  setEditId(null)
                  setForm({username:'', password:'', name:'', role:'STAFF', active:true, phone:'', email:'', perms: permsFromRole('STAFF')})
                  setErrors({})
                  setShowPassword(false)
                }}
              >
                <FaTimes />
                ยกเลิก
              </button>
            )}
          </div>

          {/* Preview เมื่อแก้ไข */}
          {editId && (
            <div className={styles.editPreview}>
              <h3 className={styles.previewTitle}>กำลังแก้ไขผู้ใช้งาน</h3>
              <div className={styles.previewRow}>
                <span><b>ชื่อผู้ใช้:</b> {form.username}</span>
                <span><b>ชื่อ-นามสกุล:</b> {form.name}</span>
                <span><b>สิทธิ์:</b> {form.role === 'ADMIN' ? 'ผู้ดูแลระบบ' : 'พนักงาน'}</span>
                <span><b>เบอร์โทรศัพท์:</b> {form.phone || '-'}</span>
                <span><b>อีเมล:</b> {form.email || '-'}</span>
                <span>
                  <b>สถานะ:</b>{' '}
                  <span className={form.active ? styles.statusActive : styles.statusInactive}>
                    {form.active ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}
                  </span>
                </span>
                <span className={styles.permPreviewLine}>
                  <b>เข้าถึง:</b> {tagsFromPerms(form.perms).join(' · ') || '-'}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* ====== Table Card ====== */}
         <div className={styles.tableScroll}>
    <table className={styles.table}>
      <thead>
        <tr>
          <th>ชื่อผู้ใช้</th>
          <th>ชื่อ-นามสกุล</th>
          <th>บทบาท</th>
          <th>สิทธิ์การเข้าถึง</th>
          <th>เบอร์โทรศัพท์</th>
          <th>อีเมล</th>
          <th>สถานะ</th>
          <th className={styles.right}>จัดการ</th>
        </tr>
      </thead>
      <tbody>
              {users.map(u=>(
                <tr key={u.id}>
                  <td>{u.username}</td>
                  <td>{u.name}</td>
                  <td>{u.role === 'ADMIN' ? 'ผู้ดูแลระบบ' : 'พนักงาน'}</td>
                  <td>
                    <div className={styles.permTags}>{tagsFromPerms(normalizePermsObj(u.perms, u.role)).map((t,i)=>(
                        <span key={i} className={styles.tag}>{t}</span>
                      ))}
                    </div>
                  </td>
                  <td>{u.phone}</td>
                  <td>{u.email}</td>
                  <td>
                    <span className={u.active ? styles.statusActive : styles.statusInactive}>
                      {u.active ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}
                    </span>
                  </td>
                  <td className={styles.right}>
                    <div className={styles.actionsGroup}>
                      <button className={styles.btnGhost} onClick={()=>handleEdit(u)}>
                        <FaEdit />
                        แก้ไข
                      </button>
                      <button className={styles.btnGhost} onClick={()=>updateUser({...u,active:!u.active})}>
                        {u.active ? <FaTimesCircle /> : <FaCheckCircle />}
                        {u.active?'ปิดใช้งาน':'เปิดใช้งาน'}
                      </button>
                      <button className={styles.btnDanger} onClick={()=>handleDeleteClick(u)}>
                        <FaTrash />
                        ลบ
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        open={showDeleteModal}
         onCancel={() => setShowDeleteModal(false)}
        onConfirm={handleDeleteConfirm}
        title="ยืนยันการลบผู้ใช้งาน"
        message={`คุณแน่ใจหรือไม่ที่จะลบผู้ใช้งาน "${userToDelete?.name}" (${userToDelete?.username})?`}
        danger
        icon="warning"
      />
    </div>
  )
}


