export function WorkAreaShell({ children }) {
  return (
    <div className='wa-shell'>
      <div className='wa-container'>{children}</div>
    </div>
  )
}

export function Card({ children, className = '', ...props }) {
  return <div className={`wa-card ${className}`.trim()} {...props}>{children}</div>
}

export function Button({ children, variant = 'default', className = '', ...props }) {
  const variantClass = variant === 'primary' ? 'wa-btn-primary' : ''
  return <button className={`wa-btn wa-focus ${variantClass} ${className}`.trim()} {...props}>{children}</button>
}

export function Input(props) {
  return <input className='wa-input wa-focus' {...props} />
}

export function Select({ children, ...props }) {
  return <select className='wa-select wa-focus' {...props}>{children}</select>
}

export function Banner({ type = 'error', children }) {
  const typeClass = type === 'success' ? 'wa-banner-success' : 'wa-banner-error'
  return <div className={`wa-banner ${typeClass}`}>{children}</div>
}
