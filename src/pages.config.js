import Dashboard from './pages/Dashboard';
import Locations from './pages/Locations';
import Employees from './pages/Employees';
import Allocations from './pages/Allocations';


export const PAGES = {
    "Dashboard": Dashboard,
    "Locations": Locations,
    "Employees": Employees,
    "Allocations": Allocations,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
};