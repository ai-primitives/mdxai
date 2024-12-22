import React, { useState } from 'react'
import { Box, Text } from 'ink'
import Spinner from 'ink-spinner'
import { Task } from 'listr'

interface FileProcessorProps {
  files: string[]
  onComplete: () => void
}

const FileProcessor: React.FC<FileProcessorProps> = ({ files, onComplete }) => {
  const [currentFile, setCurrentFile] = useState(0)

  return (
    <Box flexDirection='column'>
      <Text>
        <Spinner /> Processing {files[currentFile]}
      </Text>
      <Text>
        Progress: {currentFile + 1}/{files.length}
      </Text>
    </Box>
  )
}

export default FileProcessor
