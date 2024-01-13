import { Link, Outlet, useLocation } from '@remix-run/react'
import { Fragment } from 'react'

export default function AutomatronLayout() {
  const { pathname } = useLocation()
  return (
    <>
      <div className="flex h-16 items-end px-2">
        {Array.from(['automatron', 'knobs']).map((key) => {
          const to = `/automatron${key === 'automatron' ? '' : `/${key}`}`
          return (
            <Fragment key={key}>
              {pathname === to ? (
                <div className="border-x border-t border-#454443 bg-#252423 px-2 py-1 text-sm text-#8b8685">
                  {key}
                </div>
              ) : (
                <Link
                  to={to}
                  className="border-x border-t border-transparent px-2 py-1 text-sm text-#8b8685"
                >
                  {key}
                </Link>
              )}
            </Fragment>
          )
        })}
      </div>
      <div className="-mt-px min-h-screen border-t border-t-#454443 bg-#252423 px-4 py-4">
        <Outlet />
      </div>
    </>
  )
}
