import { Routes } from 'react-router-dom';
import { createRouteElements, type RoutePages } from './routeDefinitions';

export default function AppRoutes({ pages }: { pages: RoutePages }) {
  return <Routes>{createRouteElements(pages)}</Routes>;
}
