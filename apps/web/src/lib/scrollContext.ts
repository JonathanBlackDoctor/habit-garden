import { createContext, useContext } from 'react';

export const ScrollTopContext = createContext<() => void>(() => {});
export const useScrollToTop = () => useContext(ScrollTopContext);
