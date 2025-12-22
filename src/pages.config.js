import Dashboard from './pages/Dashboard';
import Locations from './pages/Locations';
import Employees from './pages/Employees';
import Allocations from './pages/Allocations';
import Compliance from './pages/Compliance';
import Settings from './pages/Settings';
import LocationSettings from './pages/LocationSettings';
import EmployeePortal from './pages/EmployeePortal';


export const PAGES = {
    "Dashboard": Dashboard,
    "Locations": Locations,
    "Employees": Employees,
    "Allocations": Allocations,
    "Compliance": Compliance,
    "Settings": Settings,
    "LocationSettings": LocationSettings,
    "EmployeePortal": EmployeePortal,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
};