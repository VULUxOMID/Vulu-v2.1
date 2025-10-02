#!/usr/bin/env ruby

# Path Safety & macOS Compatibility Fixes for CocoaPods Scripts
# This script fixes GNU-only readlink -f and unquoted paths in generated scripts

puts "🔧 Applying path safety fixes to CocoaPods scripts..."

target_support_files_dir = File.join(Dir.pwd, 'Pods', 'Target Support Files')

# Fix frameworks scripts
Dir.glob("#{target_support_files_dir}/**/Pods-*-frameworks.sh").each do |script_path|
  puts "  📝 Patching frameworks script: #{File.basename(script_path)}"
  
  content = File.read(script_path)
  original_content = content.dup
  
  # Fix GNU-only readlink -f with Python realpath
  content.gsub!(
    /source="\$\(readlink -f "\$\{source\}"\)"/,
    'source="$(/usr/bin/python3 -c \'import os,sys; print(os.path.realpath(sys.argv[1]))\' "${source}")"'
  )
  
  # Fix symlinked binary handling with proper path resolution
  content.gsub!(
    /binary="\$\{dirname\}\/\$\(readlink "\$\{binary\}"\)"/,
    'binary="$(/usr/bin/python3 -c \'import os,sys; p=sys.argv[1]; d=os.path.dirname(p); t=os.readlink(p); print(t if os.path.isabs(t) else os.path.normpath(os.path.join(d,t)))\' "$binary")"'
  )
  
  if content != original_content
    File.write(script_path, content)
    puts "    ✅ Fixed GNU readlink compatibility"
  else
    puts "    ℹ️  Already fixed"
  end
end

# Fix resources scripts
Dir.glob("#{target_support_files_dir}/**/Pods-*-resources.sh").each do |script_path|
  puts "  📝 Patching resources script: #{File.basename(script_path)}"
  
  content = File.read(script_path)
  original_content = content.dup
  
  # Fix unquoted RESOURCES_TO_COPY variable
  content.gsub!(
    /^RESOURCES_TO_COPY=\$\{PODS_ROOT\}\/resources-to-copy-\$\{TARGETNAME\}\.txt$/,
    'RESOURCES_TO_COPY="${PODS_ROOT}/resources-to-copy-${TARGETNAME}.txt"'
  )
  
  # Fix unquoted paths in echo statements for ibtool commands
  content.gsub!(
    /--compile \$\{TARGET_BUILD_DIR\}\/\$\{UNLOCALIZED_RESOURCES_FOLDER_PATH\}\//,
    '--compile "${TARGET_BUILD_DIR}/${UNLOCALIZED_RESOURCES_FOLDER_PATH}/"'
  )
  
  content.gsub!(
    /\$RESOURCE_PATH --sdk \$\{SDKROOT\} \$\{TARGET_DEVICE_ARGS\}/,
    '"$RESOURCE_PATH" --sdk "${SDKROOT}" ${TARGET_DEVICE_ARGS}'
  )
  
  # Fix rsync command quoting
  content.gsub!(
    /rsync --delete -av "\$\{RSYNC_PROTECT_TMP_FILES\[@\]\}" \$RESOURCE_PATH \$\{TARGET_BUILD_DIR\}\/\$\{FRAMEWORKS_FOLDER_PATH\}/,
    'rsync --delete -av "${RSYNC_PROTECT_TMP_FILES[@]}" "$RESOURCE_PATH" "${TARGET_BUILD_DIR}/${FRAMEWORKS_FOLDER_PATH}"'
  )
  
  if content != original_content
    File.write(script_path, content)
    puts "    ✅ Fixed path quoting"
  else
    puts "    ℹ️  Already fixed"
  end
end

# Fix hard-coded paths in expo-configure-project.sh
Dir.glob("#{target_support_files_dir}/**/expo-configure-project.sh").each do |script_path|
  puts "  📝 Patching Expo configure script: #{File.basename(script_path)}"
  
  content = File.read(script_path)
  original_content = content.dup
  
  # Replace hard-coded absolute paths with environment variables
  content.gsub!(
    %r{--target "/[^"]*?/ios/Pods/Target Support Files/([^/]+)/ExpoModulesProvider\.swift"},
    '--target "${PODS_ROOT}/Target Support Files/\1/ExpoModulesProvider.swift"'
  )
  
  content.gsub!(
    %r{--entitlement "/[^"]*?/ios/([^/]+)/\1\.entitlements"},
    '--entitlement "${PODS_ROOT}/../\1/\1.entitlements"'
  )
  
  if content != original_content
    File.write(script_path, content)
    puts "    ✅ Fixed hard-coded paths"
  else
    puts "    ℹ️  Already fixed"
  end
end

puts "✅ Path safety fixes applied successfully!"
