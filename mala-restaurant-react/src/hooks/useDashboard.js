import React from 'react'
import API from '../services/api'
import dayjs from "dayjs"
import isSameOrAfter from "dayjs/plugin/isSameOrAfter"
import isSameOrBefore from "dayjs/plugin/isSameOrBefore"

dayjs.extend(isSameOrAfter)
dayjs.extend(isSameOrBefore)

export function useOrdersData(startDate, endDate) {
  const [orders, setOrders] = React.useState([])
  const [loading, setLoading] = React.useState(false)

  React.useEffect(() => {
    const fetchOrders = async () => {
      try {
        setLoading(true)
        const data = await API.orders.list()
        setOrders(data || [])
      } catch (err) {
        console.error('Error fetching orders:', err)
        setOrders([])
      } finally {
        setLoading(false)
      }
    }
    fetchOrders()
  }, [])

  // Calculate metrics
  const metrics = React.useMemo(() => {
    const totalOrders = orders.length
    const totalRevenue = orders.reduce((sum, o) => sum + Number(o.total || 0), 0)
    const todayOrders = orders.filter(o => 
      dayjs(o.createdAt).isSame(dayjs(), 'day')
    ).length
    const avgOrderValue = totalRevenue / (totalOrders || 1)

    return {
      totalOrders,
      totalRevenue,
      todayOrders,
      avgOrderValue
    }
  }, [orders])

  // Filter orders by date range
  const filteredOrders = React.useMemo(() => {
    if (!startDate || !endDate) return orders
    const start = dayjs(startDate, "YYYY-MM-DD").startOf("day")
    const end = dayjs(endDate, "YYYY-MM-DD").endOf("day")
    return orders.filter((o) => {
      const dt = dayjs(o.createdAt)
      return dt.isSameOrAfter(start) && dt.isSameOrBefore(end)
    })
  }, [orders, startDate, endDate])

  return {
    orders: filteredOrders,
    loading,
    metrics,
    refetch: () => {
      setLoading(true)
      API.orders.list()
        .then(setOrders)
        .finally(() => setLoading(false))
    }
  }
}

export function useUsersData() {
  const [users, setUsers] = React.useState([])
  const [loading, setLoading] = React.useState(false)

  React.useEffect(() => {
    const fetchUsers = async () => {
      try {
        setLoading(true)
        const data = await API.users.list()
        setUsers(data || [])
      } catch (err) {
        console.error('Error fetching users:', err)
        setUsers([])
      } finally {
        setLoading(false)
      }
    }
    fetchUsers()
  }, [])

  const userMetrics = React.useMemo(() => {
    const totalUsers = users.length
    const activeUsers = users.filter(u => u.status === 'active').length
    const newUsersToday = users.filter(u => 
      dayjs(u.createdAt).isSame(dayjs(), 'day')
    ).length

    return {
      totalUsers,
      activeUsers,
      newUsersToday
    }
  }, [users])

  return {
    users,
    loading,
    metrics: userMetrics,
    refetch: () => {
      setLoading(true)
      API.users.list()
        .then(setUsers)
        .finally(() => setLoading(false))
    }
  }
}

export function useProductsData() {
  const [products, setProducts] = React.useState([])
  const [loading, setLoading] = React.useState(false)

  React.useEffect(() => {
    const fetchProducts = async () => {
      try {
        setLoading(true)
        const data = await API.products.list()
        setProducts(data || [])
      } catch (err) {
        console.error('Error fetching products:', err)
        setProducts([])
      } finally {
        setLoading(false)
      }
    }
    fetchProducts()
  }, [])

  const productMetrics = React.useMemo(() => {
    const totalProducts = products.length
    const outOfStock = products.filter(p => (p.stock || 0) === 0).length
    const lowStock = products.filter(p => (p.stock || 0) > 0 && (p.stock || 0) <= 5).length

    return {
      totalProducts,
      outOfStock,
      lowStock
    }
  }, [products])

  return {
    products,
    loading,
    metrics: productMetrics,
    refetch: () => {
      setLoading(true)
      API.products.list()
        .then(setProducts)
        .finally(() => setLoading(false))
    }
  }
}

export function useDashboardData() {
  const ordersData = useOrdersData()
  const usersData = useUsersData()
  const productsData = useProductsData()

  const allLoading = ordersData.loading || usersData.loading || productsData.loading

  return {
    orders: ordersData,
    users: usersData,
    products: productsData,
    loading: allLoading,
    refetchAll: () => {
      ordersData.refetch()
      usersData.refetch()
      productsData.refetch()
    }
  }
}