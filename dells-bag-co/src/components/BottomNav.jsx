import { Link, useLocation } from 'react-router-dom'
import { useCart } from '../context/CartContext.jsx'

function BottomNav() {
  const location = useLocation()
  const { unseenOrdersCount } = useCart()

  const links = [
    { path: '/dashboard', icon: 'bi-house', activeIcon: 'bi-house-fill', label: 'Home' },
    { path: '/shop', icon: 'bi-shop', activeIcon: 'bi-shop', label: 'Shop' },
    { path: '/orders', icon: 'bi-receipt', activeIcon: 'bi-receipt', label: 'Orders', badgeCount: unseenOrdersCount },
    { path: '/profile', icon: 'bi-person', activeIcon: 'bi-person-fill', label: 'Me' },
  ]

  return (
    <nav className="bottom-nav d-flex justify-content-around align-items-center" aria-label="Primary navigation">
      {links.map((link) => {
        const isActive = location.pathname === link.path
        return (
          <Link
            key={link.path}
            to={link.path}
            className={`bottom-nav-link position-relative text-center py-1 ${isActive ? 'active' : ''}`}
          >
            <span className="position-relative d-inline-block">
              <i className={`bi ${isActive ? link.activeIcon : link.icon}`}></i>
              {!!link.badgeCount && (
                <span className="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger">
                  {link.badgeCount > 99 ? '99+' : link.badgeCount}
                </span>
              )}
            </span>
            <span>{link.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}

export default BottomNav
