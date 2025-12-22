import AllocationDetail from './pages/AllocationDetail';
import Allocations from './pages/Allocations';
import Compliance from './pages/Compliance';
import ConnectSquare from './pages/ConnectSquare';
import Dashboard from './pages/Dashboard';
import Disputes from './pages/Disputes';
import EmployeePortal from './pages/EmployeePortal';
import Employees from './pages/Employees';
import Ledger from './pages/Ledger';
import LocationSettings from './pages/LocationSettings';
import Locations from './pages/Locations';
import Reconciliation from './pages/Reconciliation';
import RulesBuilder from './pages/RulesBuilder';
import Settings from './pages/Settings';
import Exports from './pages/Exports';
import __Layout from './Layout.jsx';


export const PAGES = {
    "AllocationDetail": AllocationDetail,
    "Allocations": Allocations,
    "Compliance": Compliance,
    "ConnectSquare": ConnectSquare,
    "Dashboard": Dashboard,
    "Disputes": Disputes,
    "EmployeePortal": EmployeePortal,
    "Employees": Employees,
    "Ledger": Ledger,
    "LocationSettings": LocationSettings,
    "Locations": Locations,
    "Reconciliation": Reconciliation,
    "RulesBuilder": RulesBuilder,
    "Settings": Settings,
    "Exports": Exports,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: __Layout,
};