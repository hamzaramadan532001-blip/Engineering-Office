"use client";
import { Title } from "@mantine/core";
import type React from "react";
import { useRef, useState } from "react";
import { HiOutlineDocumentArrowDown } from "react-icons/hi2";
import Text from "../Text";
import styles from "./styles.module.scss";

interface DnDFileInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  helperText: string;
}

export default function DnDFileInput({
  helperText,
  onChange,
  className,
  ...props
}: DnDFileInputProps) {
  const [isDragging, setIsDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  // Handle file drop
  const handleDrop = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      // Create a mock change event to pass to the existing onChange handler
      const mockEvent = {
        target: {
          files: e.dataTransfer.files,
          value: "", // standard file input behavior reset
        },
      } as unknown as React.ChangeEvent<HTMLInputElement>;

      if (props.accept) {
        const files = Array.from(e.dataTransfer.files);
        const acceptTokens = props.accept.split(",").map((token) => token.trim());
        const isAllowed = files.every((file) =>
          acceptTokens.some((token) => {
            if (token.startsWith(".")) {
              return file.name.toLowerCase().endsWith(token.toLowerCase());
            }
            if (token.endsWith("/*")) {
              return file.type.startsWith(token.slice(0, -1));
            }
            return file.type === token;
          }),
        );
        if (!isAllowed) {
          return;
        }
      }

      if (fileRef.current) {
        fileRef.current.files = e.dataTransfer.files;
      }

      if (onChange) onChange(mockEvent);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  return (
    <label
      className={`${styles.dndFileInput} ${className || ""} ${isDragging ? styles.dragging : ""}`}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
    >
      <HiOutlineDocumentArrowDown size={32} />
      <Title mt="lg" mb="xs" order={4}>
        اسحب و أفلت الملفات هنا للرفع
      </Title>
      <Text c="gray.6" size="xs">
        {helperText}
      </Text>
      <Text mt="md">تصفح الملفات</Text>

      <input ref={fileRef} type="file" onChange={onChange} {...props} />
    </label>
  );
}
