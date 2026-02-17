#!/usr/bin/env node

import { loadConfig } from './src/config.js';
import { mainMenu } from './src/menu.js';

const config = await loadConfig();
await mainMenu(config);
