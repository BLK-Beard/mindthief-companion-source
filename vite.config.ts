import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import {campaignPersistence} from './server/campaignPersistence.ts';

export default defineConfig({ plugins: [react(),campaignPersistence()], server:{host:'127.0.0.1',port:5188,strictPort:true}, preview:{host:'127.0.0.1',port:5188,strictPort:true} });
