import { spawn, exec as execCallback } from 'child_process';
import os from 'os';
import * as path from 'path';
import { promisify } from 'util';
const exec = promisify(execCallback);
const platform = os.platform();
