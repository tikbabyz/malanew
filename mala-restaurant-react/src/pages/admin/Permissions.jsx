import React, { useState, useEffect } from "react";
import { useDataStore } from "../../store/data.js";
import styles from "./PermissionsNew.module.css";
import { 
  FaUserShield, 
  FaUsers, 
  FaCheckCircle, 
  FaTimesCircle,
  FaSave,
  FaUndo,
  FaUserCog,
  FaCog,
  FaShieldAlt,
  FaLock,
  FaUnlock,
  FaEdit,
  FaBell,
  FaChartBar,
  FaBox,
  FaCashRegister,
  FaSearch,
  FaFilter,
  FaUserEdit
} from 'react-icons/fa';

// Modern permission definitions aligned with backend
const PERMISSIONS = [
  { 
    key: 'pos', 
    label: 'หน้าขาย (POS)', 
    icon: FaCashRegister, 
    description: 'เข้าถึงระบบขายหน้าร้าน',
    color: '#10b981'
  },
  { 
    key: 'products', 
    label: 'จัดการสินค้า', 
    icon: FaBox, 
    description: 'เพิ่ม แก้ไข ลบสินค้า',
    color: '#3b82f6'
  },
  { 
    key: 'users', 
    label: 'จัดการผู้ใช้', 
    icon: FaUsers, 
    description: 'เพิ่ม แก้ไข ลบผู้ใช้งาน',
    color: '#8b5cf6'
  },
  { 
    key: 'announcements', 
    label: 'ประกาศ', 
    icon: FaBell, 
    description: 'จัดการประกาศของร้าน',
    color: '#f59e0b'
  },
  { 
    key: 'reports', 
    label: 'รายงาน', 
    icon: FaChartBar, 
    description: 'ดูรายงานและสถิติ',
    color: '#ef4444'
  }
];

const ROLE_TEMPLATES = {
  ADMIN: {
    name: 'ผู้ดูแลระบบ',
    description: 'มีสิทธิ์เข้าถึงได้ทุกส่วน',
    permissions: ['pos', 'products', 'users', 'announcements', 'reports'],
    color: '#dc2626'
  },
  STAFF: {
    name: 'พนักงาน',
    description: 'สิทธิ์พื้นฐานสำหรับการขาย',
    permissions: ['pos', 'products'],
    color: '#059669'
  },
  CASHIER: {
    name: 'แคชเชียร์',
    description: 'เฉพาะการขายเท่านั้น',
    permissions: ['pos'],
    color: '#0ea5e9'
  }
};

export default function Permissions() {
  const { users, updateUser, loading, loadUsers } = useDataStore();
  
  // State management
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState('ALL');
  const [editingUser, setEditingUser] = useState(null);
  const [tempPermissions, setTempPermissions] = useState({});
  const [hasChanges, setHasChanges] = useState(false);
  const [saving, setSaving] = useState(false);

  // Load users data on component mount
  useEffect(() => {
    const initializeData = async () => {
      try {
        console.log('🔄 Loading users data for Permissions page...');
        await loadUsers();
      } catch (error) {
        console.error('❌ Failed to load users:', error);
      }
    };

    // Load users if not already loaded
    if (users.length === 0) {
      initializeData();
    }
  }, [loadUsers, users.length]);

  // Filter users based on search and role
  const filteredUsers = users.filter(user => {
    const matchesSearch = user.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user.username?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = filterRole === 'ALL' || user.role === filterRole;
    return matchesSearch && matchesRole;
  });

  // Check if user has specific permission
  const hasPermission = (user, permKey) => {
    const perms = editingUser === user.id ? tempPermissions : (user.perms || []);
    return Array.isArray(perms) ? perms.includes(permKey) : !!perms[permKey];
  };

  // Toggle permission for user
  const togglePermission = (userId, permKey) => {
    const user = users.find(u => u.id === userId);
    if (!user) return;

    if (editingUser !== userId) {
      setEditingUser(userId);
      setTempPermissions(user.perms || []);
    }

    const currentPerms = editingUser === userId ? tempPermissions : (user.perms || []);
    let newPerms;

    if (Array.isArray(currentPerms)) {
      newPerms = currentPerms.includes(permKey) 
        ? currentPerms.filter(p => p !== permKey)
        : [...currentPerms, permKey];
    } else {
      newPerms = { ...currentPerms, [permKey]: !currentPerms[permKey] };
    }

    setTempPermissions(newPerms);
    setHasChanges(true);
  };

  // Apply role template
  const applyRoleTemplate = (userId, templateKey) => {
    const template = ROLE_TEMPLATES[templateKey];
    if (!template) return;

    setEditingUser(userId);
    setTempPermissions(template.permissions);
    setHasChanges(true);
  };

  // Save changes
  const saveChanges = async () => {
    if (!editingUser || !hasChanges) return;
    
    setSaving(true);
    try {
      const user = users.find(u => u.id === editingUser);
      await updateUser({ ...user, perms: tempPermissions });
      
      setEditingUser(null);
      setTempPermissions({});
      setHasChanges(false);
    } catch (error) {
      console.error('Failed to save permissions:', error);
    } finally {
      setSaving(false);
    }
  };

  // Cancel changes
  const cancelChanges = () => {
    setEditingUser(null);
    setTempPermissions({});
    setHasChanges(false);
  };

  // Get user stats
  const stats = {
    total: users.length,
    active: users.filter(u => u.active).length,
    admins: users.filter(u => u.role === 'ADMIN').length,
    staff: users.filter(u => u.role === 'STAFF').length
  };

  // Debug logging
  console.log('🔍 Permissions Page Debug:', {
    usersLength: users.length,
    users: users,
    loading: loading,
    filteredUsersLength: filteredUsers.length,
    stats: stats
  });

  return (
    <div className={styles.container}>
      {/* Header Section */}
      <div className={styles.permissionsHeader}>
        <div className={styles.headerContent}>
          <div className={styles.headerMain}>
            <h1 className={styles.pageTitle}>
              <FaUserShield className={styles.titleIcon} />
              จัดการสิทธิ์ผู้ใช้งาน
            </h1>
            <p className={styles.pageSubtitle}>
              กำหนดสิทธิ์การเข้าถึงสำหรับแต่ละผู้ใช้งานในระบบ
            </p>
          </div>
          <div className={styles.headerStats}>
            <div className={styles.statCard}>
              <FaUsers className={styles.statIcon} />
              <div>
                <span className={styles.statNumber}>{stats.total}</span>
                <span className={styles.statLabel}>ผู้ใช้ทั้งหมด</span>
              </div>
            </div>
            <div className={styles.statCard}>
              <FaUserShield className={styles.statIcon} />
              <div>
                <span className={styles.statNumber}>{stats.admins}</span>
                <span className={styles.statLabel}>ผู้ดูแลระบบ</span>
              </div>
            </div>
            <div className={styles.statCard}>
              <FaCheckCircle className={styles.statIcon} />
              <div>
                <span className={styles.statNumber}>{stats.active}</span>
                <span className={styles.statLabel}>ใช้งานอยู่</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className={styles.permissionsContent}>
        {/* Control Panel */}
        <div className={styles.controlPanel}>
          <div className={styles.searchSection}>
            <div className={styles.searchBox}>
              <FaSearch className={styles.searchIcon} />
              <input
                type="text"
                placeholder="ค้นหาผู้ใช้งาน..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={styles.searchInput}
              />
            </div>
            <div className={styles.filterBox}>
              <FaFilter className={styles.filterIcon} />
              <select
                value={filterRole}
                onChange={(e) => setFilterRole(e.target.value)}
                className={styles.filterSelect}
              >
                <option value="ALL">บทบาททั้งหมด</option>
                <option value="ADMIN">ผู้ดูแลระบบ</option>
                <option value="STAFF">พนักงาน</option>
              </select>
            </div>
          </div>

          {hasChanges && (
            <div className={styles.changesAlert}>
              <div className={styles.changesContent}>
                <FaEdit className={styles.changesIcon} />
                <span>มีการเปลี่ยนแปลงที่ยังไม่ได้บันทึก</span>
              </div>
              <div className={styles.changesActions}>
                <button 
                  className={styles.saveButton}
                  onClick={saveChanges}
                  disabled={saving}
                >
                  <FaSave />
                  {saving ? 'กำลังบันทึก...' : 'บันทึก'}
                </button>
                <button 
                  className={styles.cancelButton}
                  onClick={cancelChanges}
                  disabled={saving}
                >
                  <FaUndo />
                  ยกเลิก
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Permissions Matrix */}
        <div className={styles.permissionsMatrix}>
          <div className={styles.matrixHeader}>
            <h2 className={styles.matrixTitle}>
              <FaCog className={styles.matrixIcon} />
              เมทริกซ์สิทธิ์การใช้งาน
            </h2>
          </div>

          <div className={styles.matrixContent}>
            {loading ? (
              <div className={styles.loadingState}>
                <div className={styles.spinner}></div>
                <p>กำลังโหลดข้อมูลผู้ใช้งาน...</p>
              </div>
            ) : users.length === 0 ? (
              <div className={styles.emptyState}>
                <FaUsers className={styles.emptyIcon} />
                <h3>ไม่พบข้อมูลผู้ใช้งาน</h3>
                <p>ตรวจสอบการเชื่อมต่อฐานข้อมูลหรือสร้างผู้ใช้ใหม่</p>
                <button 
                  className={styles.retryButton}
                  onClick={() => loadUsers()}
                >
                  ลองใหม่
                </button>
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className={styles.emptyState}>
                <FaUsers className={styles.emptyIcon} />
                <h3>ไม่พบผู้ใช้งานที่ตรงกับการค้นหา</h3>
                <p>ลองเปลี่ยนคำค้นหาหรือตัวกรอง</p>
              </div>
            ) : (
              <div className={styles.matrixTable}>
                <div className={styles.tableHeader}>
                  <div className={styles.userColumn}>ผู้ใช้งาน</div>
                  <div className={styles.roleColumn}>บทบาท</div>
                  {PERMISSIONS.map(perm => (
                    <div key={perm.key} className={styles.permColumn}>
                      <perm.icon className={styles.permIcon} style={{ color: perm.color }} />
                      <span className={styles.permLabel}>{perm.label}</span>
                    </div>
                  ))}
                  <div className={styles.actionsColumn}>จัดการ</div>
                </div>

                {filteredUsers.map(user => (
                  <div 
                    key={user.id} 
                    className={`${styles.tableRow} ${editingUser === user.id ? styles.editing : ''} ${!user.active ? styles.inactive : ''}`}
                  >
                    <div className={styles.userInfo}>
                      <div className={styles.userAvatar}>
                        <FaUserCog />
                      </div>
                      <div className={styles.userDetails}>
                        <span className={styles.userName}>{user.name || user.username}</span>
                        <span className={styles.userMeta}>@{user.username}</span>
                        {!user.active && <span className={styles.inactiveLabel}>ปิดใช้งาน</span>}
                      </div>
                    </div>

                    <div className={styles.roleInfo}>
                      <span 
                        className={`${styles.roleBadge} ${styles[user.role?.toLowerCase()]}`}
                      >
                        {ROLE_TEMPLATES[user.role]?.name || user.role}
                      </span>
                    </div>

                    {PERMISSIONS.map(perm => (
                      <div key={perm.key} className={styles.permissionCell}>
                        <button
                          className={`${styles.permissionToggle} ${hasPermission(user, perm.key) ? styles.granted : styles.denied}`}
                          onClick={() => togglePermission(user.id, perm.key)}
                          disabled={!user.active}
                          title={`${hasPermission(user, perm.key) ? 'ปิด' : 'เปิด'}สิทธิ์ ${perm.label}`}
                        >
                          {hasPermission(user, perm.key) ? <FaCheckCircle /> : <FaTimesCircle />}
                        </button>
                      </div>
                    ))}

                    <div className={styles.userActions}>
                      {Object.keys(ROLE_TEMPLATES).map(templateKey => (
                        <button
                          key={templateKey}
                          className={`${styles.templateButton} ${styles[templateKey.toLowerCase()]}`}
                          onClick={() => applyRoleTemplate(user.id, templateKey)}
                          disabled={!user.active}
                          title={`ใช้เทมเพลต ${ROLE_TEMPLATES[templateKey].name}`}
                        >
                          {templateKey}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Permission Descriptions */}
        <div className={styles.permissionGuide}>
          <h3 className={styles.guideTitle}>
            <FaShieldAlt className={styles.guideIcon} />
            คำอธิบายสิทธิ์การใช้งาน
          </h3>
          <div className={styles.guideGrid}>
            {PERMISSIONS.map(perm => (
              <div key={perm.key} className={styles.guideCard}>
                <div className={styles.guideHeader}>
                  <perm.icon className={styles.guideCardIcon} style={{ color: perm.color }} />
                  <span className={styles.guideCardTitle}>{perm.label}</span>
                </div>
                <p className={styles.guideCardDescription}>{perm.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
