import React, { useState, type FC } from 'react'
import { Box, Text } from 'ink'

interface FileProcessorProps {
  files: string[]
  onComplete: () => void
}

const FileProcessor: FC<FileProcessorProps> = ({ files, onComplete }) => {
  const [currentFile, setCurrentFile] = useState(0)

  React.useEffect(() => {
    if (currentFile >= files.length) {
      onComplete()
      return
    }

    const timer = setTimeout(() => {
      setCurrentFile((prev) => prev + 1)
    }, 1000)

    return () => clearTimeout(timer)
  }, [currentFile, files.length, onComplete])

  if (currentFile >= files.length) {
    return null
  }

  return (
    <Box flexDirection='column'>
      <Box>
        <Text>Processing</Text>
      </Box>
      <Text>
        Progress: {currentFile + 1}/{files.length}
      </Text>
    </Box>
  )
}

export default FileProcessor
