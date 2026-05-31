export const metadata = {
  title: 'Catalyst Trading Dashboard',
  description: 'Institutional-quality AI-powered trading intelligence',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, padding: 0, background: '#0a0e17' }}>
        {children}
      </body>
    </html>
  )
}
