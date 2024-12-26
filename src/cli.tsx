#!/usr/bin/env node
import React, { useEffect, useState } from 'react'
import { render } from 'ink'
import { Box, Text } from 'ink'
import meow from 'meow'
import { generateMDX, GenerateOptions } from './index.js'
