import React from 'react';
import styles from './ResponsiveTable.module.css';

export default function ResponsiveTable({ 
  children, 
  className = '',
  stickyHeader = true,
  horizontalScroll = true
}) {
  const tableRef = React.useRef(null);
  const [canScrollLeft, setCanScrollLeft] = React.useState(false);
  const [canScrollRight, setCanScrollRight] = React.useState(false);

  // Check scroll position
  const checkScrollPosition = React.useCallback(() => {
    if (!tableRef.current) return;
    
    const { scrollLeft, scrollWidth, clientWidth } = tableRef.current;
    setCanScrollLeft(scrollLeft > 0);
    setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 1);
  }, []);

  React.useEffect(() => {
    const tableElement = tableRef.current;
    if (!tableElement) return;

    checkScrollPosition();
    tableElement.addEventListener('scroll', checkScrollPosition);
    window.addEventListener('resize', checkScrollPosition);

    return () => {
      tableElement.removeEventListener('scroll', checkScrollPosition);
      window.removeEventListener('resize', checkScrollPosition);
    };
  }, [checkScrollPosition]);

  return (
    <div className={`${styles.tableContainer} ${className}`}>
      {/* Scroll indicators */}
      {horizontalScroll && (
        <>
          {canScrollLeft && (
            <div className={`${styles.scrollIndicator} ${styles.scrollLeft}`}>
              ←
            </div>
          )}
          {canScrollRight && (
            <div className={`${styles.scrollIndicator} ${styles.scrollRight}`}>
              →
            </div>
          )}
        </>
      )}
      
      <div 
        ref={tableRef}
        className={`${styles.tableWrapper} ${
          horizontalScroll ? styles.horizontalScroll : ''
        } ${stickyHeader ? styles.stickyHeader : ''}`}
      >
        <table className={styles.table}>
          {children}
        </table>
      </div>
    </div>
  );
}

// Table components for better structure
export function TableHead({ children, className = '' }) {
  return (
    <thead className={`${styles.tableHead} ${className}`}>
      {children}
    </thead>
  );
}

export function TableBody({ children, className = '' }) {
  return (
    <tbody className={`${styles.tableBody} ${className}`}>
      {children}
    </tbody>
  );
}

export function TableRow({ children, className = '', clickable = false }) {
  return (
    <tr className={`${styles.tableRow} ${clickable ? styles.clickable : ''} ${className}`}>
      {children}
    </tr>
  );
}

export function TableHeaderCell({ 
  children, 
  className = '', 
  sortable = false, 
  sorted = null, // 'asc' | 'desc' | null
  onSort = null 
}) {
  return (
    <th 
      className={`${styles.tableHeaderCell} ${
        sortable ? styles.sortable : ''
      } ${className}`}
      onClick={sortable ? onSort : undefined}
    >
      <div className={styles.headerContent}>
        {children}
        {sortable && (
          <span className={styles.sortIcon}>
            {sorted === 'asc' ? '↑' : sorted === 'desc' ? '↓' : '↕'}
          </span>
        )}
      </div>
    </th>
  );
}

export function TableCell({ 
  children, 
  className = '', 
  mobileLabel = '',
  truncate = false 
}) {
  return (
    <td 
      className={`${styles.tableCell} ${truncate ? styles.truncate : ''} ${className}`}
      data-mobile-label={mobileLabel}
    >
      {children}
    </td>
  );
}